import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Upload, FileText, ScanLine, Sparkles, Plus, Trash2, Copy, 
  Check, CheckCircle2, AlertTriangle, RefreshCw, X, Building2, 
  Calendar, DollarSign, PackageCheck, Layers, FileSpreadsheet,
  HelpCircle, Eye, ArrowRight, Video, VideoOff
} from 'lucide-react';
import { User, Branch, Supplier, ProductCategory } from '../types';

export interface ScannedItemRow {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  subCategory?: string;
  unit: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  buyingPrice: number | string;
  price: number | string;
  minStockLevel: number;
  description?: string;
  productType: 'medicine' | 'cosmetics';
  isPrescriptionRequired: boolean;
  barcode?: string;
  branchId?: string;
}

interface ScanItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  branches: Branch[];
  activeBranchId?: string;
  suppliers: Supplier[];
  categories?: ProductCategory[];
  onImportComplete: (count: number) => void;
  initialMode?: 'photo' | 'invoice' | 'camera';
  autoStartCamera?: boolean;
}

const COMMON_UNITS = [
  'Piece (PCS)', 'Box', 'Strip', 'Bottle', 'Tablet', 'Capsule',
  'Vial', 'Ampoule', 'Tube', 'Sachet', 'Blister Pack', 'Pfs (Prefilled Syringe)',
  'Syrup Bottle', 'Jar', 'Pack', 'Roll'
];

const COMMON_CATEGORIES = [
  'Antibiotics', 'Analgesics & Pain', 'Cardiovascular', 'Gastrointestinal',
  'Respiratory', 'Vitamins & Supplements', 'Cosmetics & Skincare',
  'Dermatology', 'Medical Supplies', 'Antidiabetic', 'Anti-infective',
  'Pediatrics', 'Ophthalmic', 'First Aid', 'Chronic Care'
];

export const ScanItemsModal: React.FC<ScanItemsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  branches,
  activeBranchId,
  suppliers,
  categories = [],
  onImportComplete,
  initialMode = 'invoice',
  autoStartCamera = false
}) => {
  const [scanType, setScanType] = useState<'invoice' | 'photo'>(initialMode === 'camera' ? 'photo' : initialMode);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'review'>('upload');

  // Review state
  const [scannedItems, setScannedItems] = useState<ScannedItemRow[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');
  const [defaultBranchId, setDefaultBranchId] = useState<string>(
    (activeBranchId && activeBranchId !== 'all') ? activeBranchId : (branches[0]?.id || 'b1')
  );
  const [createPurchaseOrder, setCreatePurchaseOrder] = useState<boolean>(true);
  const [isCreditPurchase, setIsCreditPurchase] = useState<boolean>(false);
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [creditPaymentTerms, setCreditPaymentTerms] = useState<string>('Net 30');
  const [docTypeBadge, setDocTypeBadge] = useState<string>('');
  const [aiNotes, setAiNotes] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Live Camera Stream
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (suppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppliers[0].id);
    }
  }, [suppliers, selectedSupplierId]);

  useEffect(() => {
    if (!isOpen) {
      // Clean up camera on close
      stopLiveCamera();
      resetForm();
    } else {
      const mode = initialMode === 'camera' ? 'photo' : initialMode;
      setScanType(mode);
      setCreatePurchaseOrder(true);
      if (initialMode === 'camera' || autoStartCamera) {
        setTimeout(() => {
          startLiveCamera();
        }, 150);
      }
    }
  }, [isOpen, initialMode, autoStartCamera]);

  const resetForm = () => {
    setSelectedImage(null);
    setFileName('');
    setScanError(null);
    setStep('upload');
    setScannedItems([]);
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setImportSuccessMsg(null);
  };

  const stopLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsLiveCameraOpen(false);
  };

  // Ensure camera stream is attached whenever video element mounts or cameraStream updates
  useEffect(() => {
    if (isLiveCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.warn('Video play error:', e));
    }
  }, [isLiveCameraOpen, cameraStream]);

  const startLiveCamera = async () => {
    try {
      setScanError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setCameraStream(stream);
      setIsLiveCameraOpen(true);
    } catch (err: any) {
      console.warn('Direct camera stream failed, falling back to native capture:', err);
      // Trigger native phone camera picker
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        setScanError('Camera permission not granted. Please upload a photo instead.');
      }
    }
  };

  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelectedImage(dataUrl);
      setImageMime('image/jpeg');
      setFileName(`camera-scan-${Date.now()}.jpg`);
      stopLiveCamera();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setScanError(null);
    setFileName(file.name);
    setImageMime(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedImage(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setScanError('Failed to read uploaded file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Sample data generators for instant demonstration
  const loadSampleInvoice = () => {
    // Generate a clean invoice canvas image
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('PHARMACEUTICAL WHOLESALE SUPPLY INVOICE', 40, 50);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('Supplier: Ethiopian Pharmaceuticals Supply Agency (EPSA)', 40, 90);
      ctx.fillText(`Invoice #: INV-PO-${Date.now().toString().slice(-5)}`, 40, 115);
      ctx.fillText(`Date: ${new Date().toISOString().split('T')[0]}`, 40, 140);
      ctx.fillText('Items: Amoxicillin 500mg, Paracetamol 500mg, Omeprazole 20mg, Azithromycin 500mg', 40, 180);
      ctx.fillText('Batch & Exp: B2401 (Exp 2027-10-31), B2402 (Exp 2026-08-31)', 40, 210);
      ctx.font = 'italic 14px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('(Synthetic invoice preview for demonstration)', 40, 260);

      const dataUrl = canvas.toDataURL('image/jpeg');
      setSelectedImage(dataUrl);
      setImageMime('image/jpeg');
      setFileName('sample-supplier-invoice.jpg');
      setScanType('invoice');
      setCreatePurchaseOrder(true);
    }
  };

  const loadSampleProductPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('AUGMENTIN 625mg Tablets', 30, 60);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('Active: Amoxicillin + Clavulanic Acid 625mg', 30, 95);
      ctx.fillText('Pack: 2x7 Blister Pack (14 Tablets)', 30, 125);
      ctx.fillText(`Lot / Batch: LOT-AUG-${Date.now().toString().slice(-4)}`, 30, 155);
      ctx.fillText('EXP: 11/2027', 30, 185);
      ctx.fillText('Barcode: 6281005544123', 30, 215);

      const dataUrl = canvas.toDataURL('image/jpeg');
      setSelectedImage(dataUrl);
      setImageMime('image/jpeg');
      setFileName('sample-augmentin-box.jpg');
      setScanType('photo');
      setCreatePurchaseOrder(false);
    }
  };

  // Perform AI Visual OCR & Structured Extraction
  const handleScanImage = async () => {
    if (!selectedImage) {
      setScanError('Please select or capture an image first.');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch('/api/ai/scan-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: selectedImage,
          mimeType: imageMime,
          scanType: scanType
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan image.');
      }

      if (data.items && Array.isArray(data.items)) {
        const mappedRows: ScannedItemRow[] = data.items.map((item: any, idx: number) => {
          const buyPrice = parseFloat(String(item.buyingPrice)) || 0;
          let sellPrice = parseFloat(String(item.price)) || 0;
          if (!sellPrice || sellPrice <= buyPrice) {
            sellPrice = buyPrice > 0 ? Number((buyPrice * 1.3).toFixed(2)) : 100;
          }

          return {
            id: `scan_row_${Date.now()}_${idx}`,
            name: item.name || 'Unnamed Product',
            genericName: item.genericName || item.name || '',
            category: item.category || 'Antibiotics',
            subCategory: '',
            unit: item.unit || 'Piece (PCS)',
            batchNumber: item.batchNumber || `B-${Date.now().toString().slice(-4)}-${idx + 1}`,
            expiryDate: item.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            quantity: Math.max(1, Number(item.quantity) || 1),
            buyingPrice: buyPrice,
            price: sellPrice,
            minStockLevel: Number(item.minStockLevel) || 10,
            description: item.description || '',
            productType: item.productType === 'cosmetics' ? 'cosmetics' : 'medicine',
            isPrescriptionRequired: item.isPrescriptionRequired !== undefined ? !!item.isPrescriptionRequired : true,
            barcode: item.barcode || '',
            branchId: defaultBranchId
          };
        });

        setScannedItems(mappedRows);
        if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
        if (data.invoiceDate) setInvoiceDate(data.invoiceDate);
        if (data.supplierName) {
          const matched = suppliers.find(s => s.name.toLowerCase().includes(data.supplierName.toLowerCase()));
          if (matched) {
            setSelectedSupplierId(matched.id);
          } else {
            setCustomSupplierName(data.supplierName);
          }
        }
        if (data.documentType) {
          setDocTypeBadge(data.documentType === 'purchase_invoice' ? 'Purchase Invoice' : 'Product Photo / Packaging');
        }
        if (data.notes) {
          setAiNotes(data.notes);
        }

        setStep('review');
      } else {
        throw new Error('No medicine or product items detected in the image.');
      }
    } catch (err: any) {
      console.error('Extraction error:', err);
      setScanError(err.message || 'Error occurred during AI visual scanning.');
    } finally {
      setIsScanning(false);
    }
  };

  // Row update handlers
  const updateRowField = (id: string, field: keyof ScannedItemRow, value: any) => {
    setScannedItems(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value };
      // If buyingPrice changed and user hasn't explicitly set price, adjust price
      if (field === 'buyingPrice') {
        const b = parseFloat(String(value)) || 0;
        const currentP = parseFloat(String(row.price)) || 0;
        if (currentP <= b && b > 0) {
          updated.price = Number((b * 1.3).toFixed(2));
        }
      }
      return updated;
    }));
  };

  const handleDuplicateRow = (id: string) => {
    const item = scannedItems.find(r => r.id === id);
    if (!item) return;
    const duplicated: ScannedItemRow = {
      ...item,
      id: `scan_row_${Date.now()}_dup`,
      batchNumber: `${item.batchNumber}-2`
    };
    setScannedItems(prev => [...prev, duplicated]);
  };

  const handleDeleteRow = (id: string) => {
    setScannedItems(prev => prev.filter(r => r.id !== id));
  };

  const handleAddEmptyRow = () => {
    const newRow: ScannedItemRow = {
      id: `scan_row_new_${Date.now()}`,
      name: '',
      genericName: '',
      category: 'Antibiotics',
      unit: 'Piece (PCS)',
      batchNumber: `B-${Date.now().toString().slice(-4)}`,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quantity: 10,
      buyingPrice: 50,
      price: 65,
      minStockLevel: 10,
      productType: 'medicine',
      isPrescriptionRequired: false,
      branchId: defaultBranchId
    };
    setScannedItems(prev => [...prev, newRow]);
  };

  // Fast markup calculator for all items
  const applyGlobalMargin = (marginPercent: number) => {
    setScannedItems(prev => prev.map(row => {
      const buying = Number(row.buyingPrice) || 0;
      if (buying > 0) {
        return {
          ...row,
          price: Math.round(buying * (1 + marginPercent / 100))
        };
      }
      return row;
    }));
  };

  // Bulk assign branch
  const handleAssignBranchToAll = (bId: string) => {
    setDefaultBranchId(bId);
    setScannedItems(prev => prev.map(r => ({ ...r, branchId: bId })));
  };

  // Calculations
  const totalItemsCount = scannedItems.length;
  const totalQuantitySum = scannedItems.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  const totalBuyingCost = scannedItems.reduce((acc, r) => acc + ((Number(r.quantity) || 0) * (Number(r.buyingPrice) || 0)), 0);
  const totalExpectedRevenue = scannedItems.reduce((acc, r) => acc + ((Number(r.quantity) || 0) * (Number(r.price) || 0)), 0);
  const overallMarginPercent = totalBuyingCost > 0 ? Math.round(((totalExpectedRevenue - totalBuyingCost) / totalBuyingCost) * 100) : 0;

  // Submit & Import
  const handleFinalImport = async () => {
    if (scannedItems.length === 0) {
      alert('There are no items to import. Please add or scan items first.');
      return;
    }

    // Validate rows
    const invalidRow = scannedItems.find(r => !r.name.trim());
    if (invalidRow) {
      alert('Please fill in the product name for all items before importing.');
      return;
    }

    setIsImporting(true);
    setScanError(null);

    try {
      const selectedSup = suppliers.find(s => s.id === selectedSupplierId);
      const finalSupName = customSupplierName || (selectedSup ? selectedSup.name : 'Supplier');

      const normalizedItems = scannedItems.map(it => ({
        ...it,
        buyingPrice: parseFloat(String(it.buyingPrice)) || 0,
        price: parseFloat(String(it.price)) || 0,
        quantity: Math.max(1, parseInt(String(it.quantity), 10) || 1)
      }));

      const payload = {
        items: normalizedItems,
        supplierId: selectedSupplierId || undefined,
        supplierName: finalSupName,
        branchId: defaultBranchId,
        purchaseInvoiceNumber: invoiceNumber || undefined,
        invoiceDate: invoiceDate || undefined,
        operatorId: currentUser.id,
        createPurchaseOrder: createPurchaseOrder || isCreditPurchase,
        isCreditPurchase: isCreditPurchase,
        dueDate: isCreditPurchase ? creditDueDate : undefined,
        paymentTerms: isCreditPurchase ? creditPaymentTerms : undefined
      };

      const response = await fetch('/api/inventory/bulk-import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Bulk import failed.');
      }

      setImportSuccessMsg(`Successfully imported ${resData.importedCount || scannedItems.length} items to inventory!`);
      setTimeout(() => {
        onImportComplete(resData.importedCount || scannedItems.length);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Import error:', err);
      setScanError(err.message || 'Failed to import items into inventory.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const currentBranchName = branches.find(b => b.id === defaultBranchId)?.name || 'Default Branch';

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div 
        id="scan-items-modal-container" 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-inner">
              <ScanLine className="h-6 w-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Smart Inventory Scanner & Invoice OCR</h2>
                <span className="text-[11px] font-semibold bg-emerald-500/30 text-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> AI Vision 3.8
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                {step === 'upload' 
                  ? 'Capture a medicine photo or upload a supplier purchase invoice to automatically detect item details'
                  : 'Review extracted medicine items, edit prices/quantities, and import into inventory'}
              </p>
            </div>
          </div>
          <button
            id="close-scan-modal-btn"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/15 p-2 rounded-lg transition"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50 space-y-6">
          {importSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">{importSuccessMsg}</p>
                <p className="text-xs text-emerald-700">Updating inventory balances and bin card ledgers...</p>
              </div>
            </div>
          )}

          {scanError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{scanError}</span>
              </div>
              <button 
                onClick={() => setScanError(null)} 
                className="text-rose-600 hover:text-rose-900 font-semibold ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* STEP 1: Upload or Capture Screen */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
                <button
                  type="button"
                  id="tab-invoice-mode"
                  onClick={() => { setScanType('invoice'); setCreatePurchaseOrder(true); }}
                  className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 text-sm font-semibold transition shadow-sm ${
                    scanType === 'invoice'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-emerald-100 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className={`h-4 w-4 ${scanType === 'invoice' ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span>📄 Purchase Invoice / Bill</span>
                </button>

                <button
                  type="button"
                  id="tab-photo-mode"
                  onClick={() => { setScanType('photo'); setCreatePurchaseOrder(false); }}
                  className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 text-sm font-semibold transition shadow-sm ${
                    scanType === 'photo'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-emerald-100 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Camera className={`h-4 w-4 ${scanType === 'photo' ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span>📷 Medicine / Product Photo</span>
                </button>
              </div>

              {/* Live Camera View if Active */}
              {isLiveCameraOpen && (
                <div className="border border-slate-300 rounded-2xl overflow-hidden bg-black text-white relative shadow-lg max-w-2xl mx-auto">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-80 object-cover" 
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-emerald-400/60 pointer-events-none m-6 rounded-xl flex items-center justify-center">
                    <p className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                      Align medicine label or invoice within frame
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900/90 backdrop-blur-sm flex items-center justify-between">
                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <X className="h-4 w-4" /> Cancel Camera
                    </button>
                    <button
                      type="button"
                      id="capture-snapshot-btn"
                      onClick={captureCameraSnapshot}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/40 animate-pulse"
                    >
                      <Camera className="h-4 w-4" /> Capture Photo
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Dropzone & Controls */}
              {!isLiveCameraOpen && (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all bg-white relative ${
                    selectedImage ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
                  }`}
                >
                  {selectedImage ? (
                    <div className="space-y-4 max-w-md mx-auto">
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm max-h-64 bg-slate-100 flex items-center justify-center">
                        <img 
                          src={selectedImage} 
                          alt="Document Preview" 
                          className="max-h-60 w-auto object-contain rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedImage(null)}
                          className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white p-1.5 rounded-full transition shadow-md"
                          title="Remove image"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Selected: <span className="font-semibold text-slate-700">{fileName || 'Captured photo'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-inner">
                        {scanType === 'invoice' ? <FileSpreadsheet className="h-8 w-8" /> : <Camera className="h-8 w-8" />}
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-700">
                          {scanType === 'invoice'
                            ? 'Drop supplier purchase invoice image or PDF here'
                            : 'Drop medicine box photo or take a picture with camera'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Supports high-resolution PNG, JPG, JPEG, WEBP, or scanned documents
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          id="trigger-file-upload-btn"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
                        >
                          <Upload className="h-4 w-4" /> Choose File from Computer
                        </button>

                        <button
                          type="button"
                          id="trigger-live-camera-btn"
                          onClick={startLiveCamera}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
                        >
                          <Camera className="h-4 w-4" /> Open Device Camera
                        </button>

                        {/* Hidden Native File and Camera Inputs */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                          id="hidden-scan-file-input"
                        />
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                          id="hidden-native-camera-input"
                        />
                      </div>

                      {/* Quick Demonstration Samples */}
                      <div className="pt-4 border-t border-slate-100 mt-6 flex items-center justify-center gap-3 text-xs text-slate-500">
                        <span>Quick Test / Sample:</span>
                        <button
                          type="button"
                          onClick={loadSampleInvoice}
                          className="text-emerald-700 hover:text-emerald-900 font-semibold underline decoration-dotted underline-offset-4"
                        >
                          Sample Supplier Invoice
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={loadSampleProductPhoto}
                          className="text-emerald-700 hover:text-emerald-900 font-semibold underline decoration-dotted underline-offset-4"
                        >
                          Sample Medicine Box Photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Start Extraction Action Bar */}
              {selectedImage && !isLiveCameraOpen && (
                <div className="flex items-center justify-between p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Ready to Extract Medicine & Pricing Data</p>
                      <p className="text-[11px] text-slate-600">
                        Gemini Vision will detect product names, batch numbers, expiries, and costs automatically.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="start-ai-scan-btn"
                    disabled={isScanning}
                    onClick={handleScanImage}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Scanning with AI Vision...
                      </>
                    ) : (
                      <>
                        <ScanLine className="h-4 w-4" /> Analyze & Extract Items
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Review and Edit Extracted Items */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Header Context Controls */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Document Type:</span>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200">
                      {docTypeBadge || (scanType === 'invoice' ? 'Purchase Invoice' : 'Product Photo')}
                    </span>
                    {aiNotes && (
                      <span className="text-[11px] text-slate-500 italic max-w-md truncate" title={aiNotes}>
                        ({aiNotes})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Re-scan / Change Image
                  </button>
                </div>

                {/* Metadata Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice / Ref #</label>
                    <input
                      type="text"
                      id="invoice-ref-number-input"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-9042"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      id="invoice-date-input"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Supplier / Distributor</label>
                    <select
                      id="invoice-supplier-select"
                      value={selectedSupplierId}
                      onChange={(e) => {
                        setSelectedSupplierId(e.target.value);
                        if (e.target.value !== 'custom') setCustomSupplierName('');
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium"
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      <option value="custom">+ New / Custom Supplier</option>
                    </select>
                    {selectedSupplierId === 'custom' && (
                      <input
                        type="text"
                        value={customSupplierName}
                        onChange={(e) => setCustomSupplierName(e.target.value)}
                        placeholder="Enter Supplier Name"
                        className="w-full mt-1.5 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Pharmacy Branch</label>
                    <select
                      id="default-branch-select"
                      value={defaultBranchId}
                      onChange={(e) => handleAssignBranchToAll(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Specific Invoice & Payment Status Controls */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-bold text-slate-700">Invoice Payment Type:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="invoicePaymentType"
                        checked={!isCreditPurchase}
                        onChange={() => setIsCreditPurchase(false)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>💵 Paid Immediately (Cash/Bank)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-700">
                      <input
                        type="radio"
                        name="invoicePaymentType"
                        checked={isCreditPurchase}
                        onChange={() => setIsCreditPurchase(true)}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>💳 Purchased on Credit (Outbound Credit Due)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="create-po-checkbox"
                      checked={createPurchaseOrder}
                      onChange={(e) => setCreatePurchaseOrder(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <label htmlFor="create-po-checkbox" className="font-semibold text-slate-700 cursor-pointer">
                      Log as Received PO in Supplier Ledger
                    </label>
                  </div>
                </div>

                {isCreditPurchase && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-800 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                        Outbound Supplier Credit Payables Setup
                      </span>
                      <span className="text-[11px] font-mono text-rose-700 font-bold">
                        Payable Amount: {totalBuyingCost.toLocaleString()} ETB
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Payment Due Date
                        </label>
                        <input
                          type="date"
                          value={creditDueDate}
                          onChange={(e) => setCreditDueDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-xs font-semibold"
                        />
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                          <span>Quick:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 15);
                              setCreditDueDate(d.toISOString().split('T')[0]);
                              setCreditPaymentTerms('Net 15');
                            }}
                            className="underline hover:text-rose-700 cursor-pointer font-medium"
                          >
                            +15 Days
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 30);
                              setCreditDueDate(d.toISOString().split('T')[0]);
                              setCreditPaymentTerms('Net 30');
                            }}
                            className="underline hover:text-rose-700 cursor-pointer font-medium"
                          >
                            +30 Days
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 60);
                              setCreditDueDate(d.toISOString().split('T')[0]);
                              setCreditPaymentTerms('Net 60');
                            }}
                            className="underline hover:text-rose-700 cursor-pointer font-medium"
                          >
                            +60 Days
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Payment Terms / Credit Agreement
                        </label>
                        <select
                          value={creditPaymentTerms}
                          onChange={(e) => setCreditPaymentTerms(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-xs font-semibold"
                        >
                          <option value="Net 15">Net 15 Days</option>
                          <option value="Net 30">Net 30 Days (Standard)</option>
                          <option value="Net 45">Net 45 Days</option>
                          <option value="Net 60">Net 60 Days</option>
                          <option value="Net 90">Net 90 Days</option>
                          <option value="Custom Term">Custom Agreed Term</option>
                        </select>
                        <p className="text-[10px] text-rose-600 mt-1">
                          Will alert in the Outbound Credit Notification Panel when due.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Metrics Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <span className="text-[11px] text-slate-500 block">Total Items</span>
                  <span className="text-lg font-bold text-slate-800">{totalItemsCount}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <span className="text-[11px] text-slate-500 block">Total Units</span>
                  <span className="text-lg font-bold text-slate-800">{totalQuantitySum}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <span className="text-[11px] text-slate-500 block">Total Purchase Cost</span>
                  <span className="text-lg font-bold text-emerald-700">{totalBuyingCost.toLocaleString()} ETB</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <span className="text-[11px] text-slate-500 block">Retail Value</span>
                  <span className="text-lg font-bold text-blue-700">{totalExpectedRevenue.toLocaleString()} ETB</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-slate-500 block">Avg Margin</span>
                  <span className="text-lg font-bold text-indigo-700">{overallMarginPercent}%</span>
                </div>
              </div>

              {/* Batch Actions & Markup Quick Calculator */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">⚡ Auto-Calculate Selling Price:</span>
                  <button
                    type="button"
                    onClick={() => applyGlobalMargin(20)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-500 rounded-md font-semibold text-slate-700 transition"
                  >
                    +20%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGlobalMargin(25)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-500 rounded-md font-semibold text-slate-700 transition"
                  >
                    +25%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGlobalMargin(30)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-500 rounded-md font-semibold text-slate-700 transition"
                  >
                    +30%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGlobalMargin(35)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-500 rounded-md font-semibold text-slate-700 transition"
                  >
                    +35%
                  </button>
                </div>

                <button
                  type="button"
                  id="add-item-row-btn"
                  onClick={handleAddEmptyRow}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Another Item Row
                </button>
              </div>

              {/* Editable Items Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200 text-slate-700 uppercase tracking-wider text-[10px] font-bold z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Product / Brand Name *</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Generic Name</th>
                        <th className="py-2.5 px-3 min-w-[120px]">Category</th>
                        <th className="py-2.5 px-3 min-w-[100px]">Unit</th>
                        <th className="py-2.5 px-3 min-w-[100px]">Batch #</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Expiry Date</th>
                        <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                        <th className="py-2.5 px-3 w-24 text-right">Buying (ETB)</th>
                        <th className="py-2.5 px-3 w-24 text-right">Selling (ETB)</th>
                        <th className="py-2.5 px-3 min-w-[110px]">Branch</th>
                        <th className="py-2.5 px-2 w-12 text-center" title="Prescription Required">Rx</th>
                        <th className="py-2.5 px-3 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {scannedItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          {/* Row index */}
                          <td className="py-2 px-3 text-center text-[11px] font-semibold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Brand/Product Name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateRowField(item.id, 'name', e.target.value)}
                              placeholder="Product name"
                              className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500 font-semibold ${
                                !item.name.trim() ? 'border-rose-300 bg-rose-50' : 'border-slate-300'
                              }`}
                            />
                          </td>

                          {/* Generic Name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.genericName || ''}
                              onChange={(e) => updateRowField(item.id, 'genericName', e.target.value)}
                              placeholder="Generic / active"
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>

                          {/* Category */}
                          <td className="py-2 px-3">
                            <select
                              value={item.category}
                              onChange={(e) => updateRowField(item.id, 'category', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 bg-white"
                            >
                              {COMMON_CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </td>

                          {/* Unit */}
                          <td className="py-2 px-3">
                            <select
                              value={item.unit}
                              onChange={(e) => updateRowField(item.id, 'unit', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 bg-white"
                            >
                              {COMMON_UNITS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>

                          {/* Batch # */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.batchNumber}
                              onChange={(e) => updateRowField(item.id, 'batchNumber', e.target.value)}
                              placeholder="Batch/Lot"
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </td>

                          {/* Expiry Date */}
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={item.expiryDate}
                              onChange={(e) => updateRowField(item.id, 'expiryDate', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateRowField(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 px-1.5 py-1 text-xs border border-slate-300 rounded text-center focus:ring-1 focus:ring-emerald-500 font-bold"
                            />
                          </td>

                          {/* Buying Price */}
                          <td className="py-2 px-3 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={item.buyingPrice}
                              onChange={(e) => {
                                const val = e.target.value.replace(',', '.');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  updateRowField(item.id, 'buyingPrice', val);
                                }
                              }}
                              className="w-20 px-1.5 py-1 text-xs border border-slate-300 rounded text-right focus:ring-1 focus:ring-emerald-500 font-medium font-mono"
                            />
                          </td>

                          {/* Selling Price */}
                          <td className="py-2 px-3 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={item.price}
                              onChange={(e) => {
                                const val = e.target.value.replace(',', '.');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  updateRowField(item.id, 'price', val);
                                }
                              }}
                              className="w-20 px-1.5 py-1 text-xs border border-emerald-300 rounded text-right focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-800 bg-emerald-50/50 font-mono"
                            />
                          </td>

                          {/* Branch */}
                          <td className="py-2 px-3">
                            <select
                              value={item.branchId || defaultBranchId}
                              onChange={(e) => updateRowField(item.id, 'branchId', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 bg-white"
                            >
                              {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </td>

                          {/* Rx */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.isPrescriptionRequired}
                              onChange={(e) => updateRowField(item.id, 'isPrescriptionRequired', e.target.checked)}
                              className="h-3.5 w-3.5 text-emerald-600 rounded border-slate-300"
                              title="Requires Prescription"
                            />
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateRow(item.id)}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded transition"
                                title="Duplicate Row"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
                                title="Remove Row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {scannedItems.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No items in table. Click "+ Add Another Item Row" to create an entry.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between">
          <div>
            {step === 'review' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                ← Back to Upload
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>

            {step === 'review' && (
              <button
                type="button"
                id="submit-bulk-import-btn"
                disabled={isImporting || scannedItems.length === 0}
                onClick={handleFinalImport}
                className={`px-6 py-2.5 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition cursor-pointer ${
                  isCreditPurchase
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-700/25'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20'
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Adding All Items to Invoice...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Add Every Item ({totalItemsCount}) on Invoice {invoiceNumber ? `#${invoiceNumber}` : ''} {isCreditPurchase ? '(On Credit)' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
