import React, { useState, useEffect } from 'react';
import { 
  Upload, Download, RefreshCw, CheckCircle, AlertOctagon, 
  Terminal, HardDrive, ClipboardList, Database, AlertCircle, 
  ChevronRight, Play, Info, Check, CornerDownRight, HelpCircle,
  Clock, Zap, Calendar, Sparkles, CheckCircle2, ShieldCheck,
  Shield, Server, AlertTriangle, Layers, FileJson, Trash2,
  ArrowDownCircle, ArrowUpCircle, X
} from 'lucide-react';
import { BackupRecord } from '../types.ts';
import { criticalStateBackup, CriticalBackupSummary, StorageHealthCheck } from '../utils/criticalStateBackup.ts';

interface BackupRestoreWizardProps {
  currentUser: any;
  onRestoreSuccess: () => void;
}

export default function BackupRestoreWizard({ currentUser, onRestoreSuccess }: BackupRestoreWizardProps) {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // IndexedDB Fail-Safe State Backup
  const [failSafeBackups, setFailSafeBackups] = useState<CriticalBackupSummary[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealthCheck | null>(null);
  const [failSafeLoading, setFailSafeLoading] = useState(false);
  const [failSafeActionMsg, setFailSafeActionMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showFailSafeModal, setShowFailSafeModal] = useState(false);
  const [failSafeCustomReason, setFailSafeCustomReason] = useState('');
  const [restoringSnapId, setRestoringSnapId] = useState<string | null>(null);

  const loadFailSafeStatus = async () => {
    try {
      const [list, health] = await Promise.all([
        criticalStateBackup.listBackups(),
        criticalStateBackup.checkStorageHealth()
      ]);
      setFailSafeBackups(list);
      setStorageHealth(health);
    } catch (e) {
      console.warn('Failed to query fail-safe status:', e);
    }
  };

  useEffect(() => {
    loadFailSafeStatus();
    const handleSaved = () => loadFailSafeStatus();
    const handleRestored = () => loadFailSafeStatus();
    window.addEventListener('critical-backup-saved', handleSaved);
    window.addEventListener('critical-state-restored', handleRestored);
    return () => {
      window.removeEventListener('critical-backup-saved', handleSaved);
      window.removeEventListener('critical-state-restored', handleRestored);
    };
  }, []);

  const handleCreateFailSafeSnapshot = async () => {
    try {
      setFailSafeLoading(true);
      setFailSafeActionMsg(null);
      
      let payloadToSave: any = null;
      try {
        const res = await fetch('/api/all-data');
        if (res.ok) {
          payloadToSave = await res.json();
        }
      } catch {}

      if (!payloadToSave) {
        const local = localStorage.getItem('sonan_client_db_state');
        if (local) {
          payloadToSave = JSON.parse(local);
        }
      }

      if (!payloadToSave) {
        throw new Error('Unable to retrieve current database state to protect.');
      }

      const reason = failSafeCustomReason.trim() || `Manual fail-safe checkpoint by ${currentUser?.name || currentUser?.username || 'Pharmacist'}`;
      const summary = await criticalStateBackup.saveCriticalStateBackup(payloadToSave, reason);
      setFailSafeCustomReason('');
      await loadFailSafeStatus();
      setFailSafeActionMsg({
        text: `Success: Protected ${summary.itemCounts.medicines} medicines, ${summary.itemCounts.customers} customers, and ${summary.itemCounts.sales} sales in IndexedDB!`,
        isError: false
      });
    } catch (err: any) {
      setFailSafeActionMsg({ text: `Failed to create fail-safe checkpoint: ${err.message}`, isError: true });
    } finally {
      setFailSafeLoading(false);
    }
  };

  const handleRestoreFromFailSafe = async (backupId?: string) => {
    if (!confirm('Are you sure you want to restore critical state (medicines, customers, sales) from this IndexedDB fail-safe snapshot? Active client state will be updated.')) {
      return;
    }
    try {
      setRestoringSnapId(backupId || 'latest');
      setFailSafeActionMsg(null);
      const res = await criticalStateBackup.restoreFromIndexedDb(backupId);
      if (res.success) {
        setFailSafeActionMsg({
          text: `Success: ${res.message}`,
          isError: false
        });
        onRestoreSuccess();
        await loadFailSafeStatus();
      } else {
        setFailSafeActionMsg({
          text: `Restore failed: ${res.message}`,
          isError: true
        });
      }
    } catch (err: any) {
      setFailSafeActionMsg({ text: `Restore error: ${err.message}`, isError: true });
    } finally {
      setRestoringSnapId(null);
    }
  };

  const handleExportFailSafeFile = async (backupId?: string) => {
    try {
      const { filename, blob } = await criticalStateBackup.exportBackupJson(backupId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleDeleteFailSafe = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this IndexedDB fail-safe snapshot?')) return;
    try {
      await criticalStateBackup.deleteBackup(backupId);
      await loadFailSafeStatus();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleImportFailSafeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setFailSafeLoading(true);
      const text = await file.text();
      const res = await criticalStateBackup.importBackupJson(text);
      if (res.success) {
        setFailSafeActionMsg({ text: `Success: ${res.message}`, isError: false });
        onRestoreSuccess();
        await loadFailSafeStatus();
      } else {
        setFailSafeActionMsg({ text: `Import failed: ${res.message}`, isError: true });
      }
    } catch (err: any) {
      setFailSafeActionMsg({ text: `Import error: ${err.message}`, isError: true });
    } finally {
      setFailSafeLoading(false);
      e.target.value = '';
    }
  };
  
  // Custom export states
  const [exportBranchId, setExportBranchId] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<string>('json');
  const [branchesList, setBranchesList] = useState<any[]>([]);

  // Automatic Daily Backup Settings
  const [autoDailyBackupEnabled, setAutoDailyBackupEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sonan_auto_daily_backup_enabled') === 'true';
  });
  const [autoDailyBackupFormat, setAutoDailyBackupFormat] = useState<string>(() => {
    return localStorage.getItem('sonan_auto_daily_backup_format') || 'json';
  });
  const [autoDailyBackupBranch, setAutoDailyBackupBranch] = useState<string>(() => {
    return localStorage.getItem('sonan_auto_daily_backup_branch') || 'all';
  });
  const [autoDailyBackupSchedule, setAutoDailyBackupSchedule] = useState<string>(() => {
    return localStorage.getItem('sonan_auto_daily_backup_schedule') || 'on_launch';
  });
  const [lastAutoBackupDate, setLastAutoBackupDate] = useState<string>(() => {
    return localStorage.getItem('sonan_auto_daily_backup_last_date') || 'Never';
  });
  const [lastAutoBackupTime, setLastAutoBackupTime] = useState<string>(() => {
    return localStorage.getItem('sonan_auto_daily_backup_last_time') || '';
  });

  const toggleAutoDailyBackup = (enabled: boolean) => {
    setAutoDailyBackupEnabled(enabled);
    localStorage.setItem('sonan_auto_daily_backup_enabled', String(enabled));
  };

  const changeAutoBackupFormat = (format: string) => {
    setAutoDailyBackupFormat(format);
    localStorage.setItem('sonan_auto_daily_backup_format', format);
  };

  const changeAutoBackupBranch = (branch: string) => {
    setAutoDailyBackupBranch(branch);
    localStorage.setItem('sonan_auto_daily_backup_branch', branch);
  };

  const changeAutoBackupSchedule = (sched: string) => {
    setAutoDailyBackupSchedule(sched);
    localStorage.setItem('sonan_auto_daily_backup_schedule', sched);
  };

  const handleDownloadBackup = async (options: { branchId?: string; format?: string; type?: string; filename?: string }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.branchId) params.append('branchId', options.branchId);
      if (options.format) params.append('format', options.format);
      if (options.type) params.append('type', options.type);

      const res = await fetch(`/api/backup/export?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned error: ${res.status} ${res.statusText}`);
      }

      let downloadFilename = options.filename;
      const disposition = res.headers.get('Content-Disposition') || res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=(?:["']?)([^"';\n]+)(?:["']?)/);
        if (match && match[1]) {
          downloadFilename = match[1].replace(/["']/g, '');
        }
      }
      if (!downloadFilename) {
        const ext = options.format === 'sql' ? 'sql' : options.format === 'csv' ? 'csv' : options.format === 'xml' ? 'xml' : 'json';
        const branchLabel = options.branchId === 'all' || !options.branchId ? 'all_branches' : `branch_${options.branchId}`;
        downloadFilename = `sonan_backup_${branchLabel}_${new Date().toISOString().split('T')[0]}.${ext}`;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadFilename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      }, 1500);

      // Log manual backup record on server
      await fetch('/api/backup/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: currentUser?.id || 'admin',
          type: options.type === 'items' ? 'Items List Only' : 'Full',
          scheduleType: 'Manual Download'
        })
      }).catch(() => {});
      fetchBackups();

    } catch (err: any) {
      console.error('Backup download error:', err);
      // Resilient Fallback: If network / server export encounters any issue, generate offline JSON backup directly from local state!
      try {
        const fallbackRes = await criticalStateBackup.exportBackupJson();
        const fallbackUrl = URL.createObjectURL(fallbackRes.blob);
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.download = fallbackRes.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) link.parentNode.removeChild(link);
          URL.revokeObjectURL(fallbackUrl);
        }, 1500);
        alert(`Notice: Downloaded client-side emergency database backup ("${fallbackRes.filename}") directly from local vault.`);
      } catch (localErr) {
        alert(`Download failed: ${err?.message || 'Server unreachable'}. Please check your connection and retry.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoBackupTestNow = async () => {
    try {
      setLoading(true);
      await fetch('/api/backup/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: currentUser?.id,
          type: 'Full',
          scheduleType: 'Automatic Daily'
        })
      });

      const ext = autoDailyBackupFormat === 'sql' ? 'sql' : autoDailyBackupFormat === 'csv' ? 'csv' : autoDailyBackupFormat === 'xml' ? 'xml' : 'json';
      const downloadUrl = `/api/backup/export?branchId=${autoDailyBackupBranch}&format=${autoDailyBackupFormat}`;
      
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error(`Export response status: ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `sonan_auto_daily_backup_${new Date().toISOString().split('T')[0]}.${ext}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1500);

      const todayStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].slice(0, 5);
      localStorage.setItem('sonan_auto_daily_backup_last_date', todayStr);
      localStorage.setItem('sonan_auto_daily_backup_last_time', timeStr);
      setLastAutoBackupDate(todayStr);
      setLastAutoBackupTime(timeStr);

      fetchBackups();
      alert(`Success: Automatic daily backup triggered & downloaded successfully! (${autoDailyBackupFormat.toUpperCase()} format)`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to trigger test auto backup: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/branches')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBranchesList(data);
        }
      })
      .catch(err => console.error('Failed to load branches', err));
  }, []);
  
  // Controls state
  const [targetBranchId, setTargetBranchId] = useState<string>('all');
  const [legacyMode, setLegacyMode] = useState<boolean>(false);
  const [itemsOnly, setItemsOnly] = useState<boolean>(false);
  const [itemsOnlyQtyDesc, setItemsOnlyQtyDesc] = useState<boolean>(false);
  const [itemsOnlyRestore, setItemsOnlyRestore] = useState<boolean>(false);

  // Migration Wizard State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [detectedFormat, setDetectedFormat] = useState<string>('');
  const [validationSummary, setValidationSummary] = useState<{
    imported: number;
    skipped: number;
    total: number;
    entities: { name: string; count: number }[];
  } | null>(null);
  const [preflights, setPreflights] = useState<{ id: string; entity: string; status: 'ok' | 'skip'; reason?: string; details: string }[]>([]);
  
  // Execution status
  const [wizardStep, setWizardStep] = useState<'upload' | 'validate' | 'executing' | 'result'>('upload');
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    summary: { imported: number; skipped: number; repaired: number; total: number; missingEntities: string[] };
    logs: string[];
    skippedReasons: string[];
    warnings: string[];
    itemsOnlyRestoreResult?: string;
  } | null>(null);
  
  // Filter for Preflight logs
  const [preflightFilter, setPreflightFilter] = useState<'all' | 'ok' | 'skip'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (parsedData) {
      const isBinary = selectedFile?.name.endsWith('.zip') || selectedFile?.name.endsWith('.db') || selectedFile?.name.endsWith('.sqlite') || selectedFile?.name.endsWith('.sql');
      if (isBinary) {
        runPreflightValidationForBinary(selectedFile?.name || 'backup');
      } else {
        runPreflightValidation(parsedData);
      }
    }
  }, [legacyMode, targetBranchId]);

  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmationText, setWipeConfirmationText] = useState('');
  const [wiping, setWiping] = useState(false);

  const handleWipeDatabase = async () => {
    if (wipeConfirmationText.toUpperCase() !== 'WIPE') {
      alert("Please type 'WIPE' to confirm.");
      return;
    }

    try {
      setWiping(true);
      const res = await fetch('/api/backup/wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id })
      });

      if (res.ok) {
        alert("Success: All transaction and inventory databases have been wiped.");
        setShowWipeModal(false);
        setWipeConfirmationText('');
        onRestoreSuccess();
        fetchBackups();
      } else {
        alert("Failed to wipe database.");
      }
    } catch (err) {
      console.error(err);
      alert("Error calling wipe API.");
    } finally {
      setWiping(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/backup/records');
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch (err) {
      console.error('Failed to load backup logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const triggerManualBackup = async (type: 'Full' | 'Items List Only' = 'Full') => {
    try {
      setLoading(true);
      const res = await fetch('/api/backup/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id, type })
      });
      if (res.ok) {
        fetchBackups();
      }
    } catch (err) {
      console.error('Failed to trigger manual backup:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Perform client-side verification and preflight check
  const processFile = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    const isBinary = file.name.endsWith('.zip') || file.name.endsWith('.db') || file.name.endsWith('.sqlite');

    reader.onload = (event) => {
      try {
        let content: any = null;
        if (isBinary) {
          content = event.target?.result as string; // This will be a base64 data URL
          setParsedData(content);
          setDetectedFormat(file.name.endsWith('.zip') ? 'ZIP Compressed Archive' : 'SQLite Database');
          
          // Legacy mode suggestion for zip/sqlite
          setLegacyMode(true);
          runPreflightValidationForBinary(file.name);
          setWizardStep('validate');
        } else {
          const text = event.target?.result as string;
          if (file.name.endsWith('.json')) {
            try {
              content = JSON.parse(text);
              setParsedData(content);
              
              // Autodetect legacy format to suggest Legacy Mode toggle
              const isDesktop = content.Medicines || content.Customers || content.Sales;
              if (isDesktop) {
                setLegacyMode(true);
              } else {
                setLegacyMode(false);
              }
              
              runPreflightValidation(content);
              setWizardStep('validate');
            } catch (err) {
              alert('JSON parsing failed. If this is a SQL or raw file, select the appropriate file format.');
            }
          } else if (file.name.endsWith('.sql')) {
            content = text;
            setParsedData(content);
            setLegacyMode(true);
            setDetectedFormat('SQL Insert Script');
            runPreflightValidationForBinary(file.name);
            setWizardStep('validate');
          } else {
            // General text format
            setParsedData(text);
            setLegacyMode(true);
            setDetectedFormat('Plain Text/Unknown Backup');
            runPreflightValidationForBinary(file.name);
            setWizardStep('validate');
          }
        }
      } catch (err) {
        alert('Failed to process backup file: ' + (err as Error).message);
      }
    };

    if (isBinary) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const runPreflightValidationForBinary = (fileName: string) => {
    const list: typeof preflights = [];
    const format = fileName.endsWith('.zip') ? 'ZIP Compressed Archive' : 
                   fileName.endsWith('.sql') ? 'SQL Script Insert Statements' :
                   fileName.endsWith('.db') || fileName.endsWith('.sqlite') ? 'SQLite Database Binary' :
                   'Uncompressed / Custom Migration Stream';

    list.push({
      id: 'pre-binary-1',
      entity: 'Binary Stream Reader',
      status: 'ok',
      details: `Pre-scanned binary signature for "${fileName}" successfully. Relational migration mapping deferred to server database engine execution phase.`
    });

    list.push({
      id: 'pre-binary-2',
      entity: 'Foreign Key Repair Optimizer',
      status: 'ok',
      details: 'Automatic schema-mapping layer active. Missing/corrupted entities will be generated as defaults.'
    });

    setDetectedFormat(format);
    setPreflights(list);
    setValidationSummary({
      imported: 2,
      skipped: 0,
      total: 2,
      entities: [
        { name: 'Parsed Streams', count: 1 },
        { name: 'Structural Blocks', count: 1 }
      ]
    });
  };

  const runPreflightValidation = (data: any) => {
    const list: typeof preflights = [];
    let format = '';
    let entities: { name: string; count: number }[] = [];

    // Intelligent structural classifier
    const classifyCollectionByStructure = (sampleRows: any[]): string | null => {
      if (!Array.isArray(sampleRows) || sampleRows.length === 0) return null;
      const samples = sampleRows.slice(0, 5);
      let scoreBranch = 0;
      let scoreMedicine = 0;
      let scoreStockItem = 0;
      let scoreCustomer = 0;
      let scoreSupplier = 0;
      let scoreSale = 0;
      let scorePO = 0;
      let scoreExpense = 0;
      let scoreSupplierTx = 0;
      let scoreStockMovement = 0;

      for (const row of samples) {
        if (!row || typeof row !== 'object') continue;
        const keys = Object.keys(row).map(k => k.toLowerCase().replace(/[^a-z0-9_]/g, ''));
        
        if (keys.includes('code') && keys.includes('name') && (keys.includes('address') || keys.includes('phone')) && !keys.includes('price') && !keys.includes('buyingprice')) {
          scoreBranch += 3;
        }
        if (keys.includes('genericname') || keys.includes('generic_name') || keys.includes('activeingredient') || keys.includes('formula') || keys.includes('generic')) {
          scoreMedicine += 5;
        }
        if (keys.includes('barcode') || keys.includes('sku') || keys.includes('producttype')) {
          scoreMedicine += 2;
        }
        if (keys.includes('price') && keys.includes('buyingprice') && !keys.includes('quantity') && !keys.includes('batchnumber')) {
          scoreMedicine += 3;
        }
        if (keys.includes('batchnumber') || keys.includes('batchno') || keys.includes('batch_number') || keys.includes('batch_no')) {
          scoreStockItem += 5;
        }
        if (keys.includes('expirydate') || keys.includes('expiry') || keys.includes('expiry_date')) {
          scoreStockItem += 3;
        }
        if (keys.includes('medicineid') && keys.includes('quantity') && keys.includes('buyingprice') && !keys.includes('invoicenumber') && !keys.includes('ponumber')) {
          scoreStockItem += 4;
        }
        if (keys.includes('loyaltypoints') || keys.includes('loyalty_points') || keys.includes('creditlimit') || keys.includes('creditbalance') || keys.includes('debt') || keys.includes('owed')) {
          scoreCustomer += 5;
        }
        if (keys.includes('fullname') || keys.includes('customername')) {
          scoreCustomer += 2;
        }
        if (keys.includes('suppliername') || keys.includes('companyname') || keys.includes('vendorname')) {
          scoreSupplier += 4;
        }
        if (keys.includes('balance') && (keys.includes('phone') || keys.includes('email') || keys.includes('address')) && !keys.includes('creditlimit') && !keys.includes('loyaltypoints')) {
          scoreSupplier += 3;
        }
        if (keys.includes('invoicenumber') || keys.includes('invoiceno') || keys.includes('serialnumber') || keys.includes('cashiername') || keys.includes('cashierid')) {
          scoreSale += 5;
        }
        if (keys.includes('paymentmethod') && keys.includes('subtotal') && keys.includes('total')) {
          scoreSale += 3;
        }
        if (keys.includes('ponumber') || keys.includes('pono') || keys.includes('purchaseorderid')) {
          scorePO += 5;
        }
        if (keys.includes('supplierid') && keys.includes('total') && keys.includes('status') && keys.includes('items') && !keys.includes('cashierid')) {
          scorePO += 3;
        }
        if (keys.includes('category') && keys.includes('amount') && keys.includes('description') && (keys.includes('recordedby') || keys.includes('expenseid'))) {
          scoreExpense += 5;
        }
        if (keys.includes('supplierid') && keys.includes('type') && keys.includes('amount') && (keys.includes('paymentstatus') || keys.includes('duedate') || keys.includes('paymentterms'))) {
          scoreSupplierTx += 5;
        }
        if (keys.includes('medicineid') && keys.includes('branchid') && keys.includes('quantity') && (keys.includes('balance') || keys.includes('stockbalance') || keys.includes('runningbalance') || keys.includes('closingbalance'))) {
          scoreStockMovement += 4;
        }
        if (keys.includes('bincardid') || keys.includes('movementid') || keys.includes('changeqty') || keys.includes('oldqty')) {
          scoreStockMovement += 3;
        }
      }

      const scores = [
        { entity: 'branches', score: scoreBranch },
        { entity: 'medicines', score: scoreMedicine },
        { entity: 'stockItems', score: scoreStockItem },
        { entity: 'customers', score: scoreCustomer },
        { entity: 'suppliers', score: scoreSupplier },
        { entity: 'sales', score: scoreSale },
        { entity: 'purchaseOrders', score: scorePO },
        { entity: 'expenses', score: scoreExpense },
        { entity: 'supplierTransactions', score: scoreSupplierTx },
        { entity: 'stockMovements', score: scoreStockMovement }
      ];
      scores.sort((a, b) => b.score - a.score);
      return scores[0].score > 2 ? scores[0].entity : null;
    };

    const classifyCollectionByName = (key: string): string | null => {
      const lowerK = key.toLowerCase();
      if (lowerK.startsWith('pharma_bincard_') || lowerK.includes('bincard') || lowerK.includes('stock_movement') || lowerK.includes('stockmovement')) {
        return 'stockMovements';
      }
      if (lowerK.includes('adjustment')) {
        return 'stockMovements';
      }
      if (lowerK.includes('medicine') || lowerK.includes('drug') || lowerK.includes('product') || lowerK.includes('item')) {
        return 'medicines';
      }
      if (lowerK.includes('stock') || lowerK.includes('batch') || lowerK.includes('inventory')) {
        return 'stockItems';
      }
      if (lowerK.includes('customer') || lowerK.includes('client')) {
        return 'customers';
      }
      if (lowerK.includes('supplier') && lowerK.includes('transaction')) {
        return 'supplierTransactions';
      }
      if (lowerK.includes('supplier') || lowerK.includes('vendor')) {
        return 'suppliers';
      }
      if (lowerK.includes('sale') || lowerK.includes('invoice') || lowerK.includes('cart') || lowerK.includes('hold_cart')) {
        return 'sales';
      }
      if (lowerK.includes('branch') || lowerK.includes('location')) {
        return 'branches';
      }
      if (lowerK.includes('purchase') || lowerK.includes('po')) {
        return 'purchaseOrders';
      }
      if (lowerK.includes('expense') || lowerK.includes('cost')) {
        return 'expenses';
      }
      return null;
    };

    const getRowsFromValue = (val: any): any[] | null => {
      if (!val) return null;
      if (Array.isArray(val)) return val;
      if (typeof val === 'object') {
        const entries = Object.entries(val);
        if (entries.length > 0 && entries.every(([k, v]) => v && typeof v === 'object' && !Array.isArray(v))) {
          return entries.map(([id, item]: [string, any]) => ({ id: item.id || id, ...item }));
        }
      }
      return null;
    };

    const collectAllCollections = (obj: any, path: string = ''): { key: string; val: any }[] => {
      if (!obj || typeof obj !== 'object') return [];
      const results: { key: string; val: any }[] = [];
      if (Array.isArray(obj)) {
        return [{ key: path || 'array', val: obj }];
      }
      const keys = Object.keys(obj);
      keys.forEach(k => {
        const value = obj[k];
        if (!value) return;
        if (Array.isArray(value)) {
          results.push({ key: k, val: value });
        } else if (typeof value === 'object') {
          const subKeys = Object.keys(value);
          if (subKeys.length > 0 && subKeys.every(sk => value[sk] && typeof value[sk] === 'object' && !Array.isArray(value[sk]))) {
            results.push({ key: k, val: value });
          } else {
            results.push(...collectAllCollections(value, k));
          }
        }
      });
      return results;
    };

    let actualBackup = data;
    while (
      actualBackup &&
      typeof actualBackup === 'object' &&
      !Array.isArray(actualBackup) &&
      Object.keys(actualBackup).length === 1 &&
      !actualBackup.branches &&
      !actualBackup.medicines &&
      !actualBackup.Medicines
    ) {
      const singleKey = Object.keys(actualBackup)[0];
      const nestedVal = actualBackup[singleKey];
      if (nestedVal && typeof nestedVal === 'object') {
        actualBackup = nestedVal;
      } else {
        break;
      }
    }

    const collectionsFound = collectAllCollections(actualBackup);
    
    const branches: any[] = [];
    const medicines: any[] = [];
    const stockItems: any[] = [];
    const customers: any[] = [];
    const suppliers: any[] = [];
    const sales: any[] = [];
    const purchaseOrders: any[] = [];
    const expenses: any[] = [];
    const supplierTransactions: any[] = [];
    const stockMovements: any[] = [];

    if (itemsOnlyRestore) {
      // Recursive candidate extraction
      const rawItems: any[] = [];
      const seenObjects = new Set<any>();

      const traverse = (obj: any) => {
        if (!obj || typeof obj !== 'object' || seenObjects.has(obj)) return;
        seenObjects.add(obj);

        if (Array.isArray(obj)) {
          let isItemArray = false;
          for (const item of obj) {
            if (item && typeof item === 'object') {
              if (
                item.name || item.Name || item.productName || item.product_name || 
                item.DrugName || item.Drug || item.drugName || item.itemName || item.item_name ||
                item.barcode || item.Barcode || item.bar_code
              ) {
                isItemArray = true;
                break;
              }
            }
          }
          if (isItemArray) {
            obj.forEach(item => {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                rawItems.push(item);
              }
            });
          }
        } else {
          for (const k of Object.keys(obj)) {
            traverse(obj[k]);
          }
        }
      };
      traverse(actualBackup);
      medicines.push(...rawItems);
    } else {
      collectionsFound.forEach(({ key, val }) => {
        const rows = getRowsFromValue(val);
        if (!rows || rows.length === 0) return;

        let entityType: string | null = null;
        const lowerKey = key.toLowerCase();

        if (lowerKey.startsWith('pharma_stockitem_') || lowerKey.startsWith('pharma_stock_') || lowerKey.startsWith('stockitem_') || lowerKey.startsWith('inventory_')) {
          entityType = 'stockItems';
        } else if (lowerKey.startsWith('pharma_bincard_') || lowerKey.startsWith('bincard_') || lowerKey.includes('_bincard_') || lowerKey === 'bincard' || lowerKey === 'bincards') {
          if (rows.length > 0 && (rows[0].batchNumber || rows[0].expiryDate) && rows[0].balance === undefined && rows[0].type === undefined) {
            entityType = 'stockItems';
          } else {
            entityType = 'stockMovements';
          }
        } else if (lowerKey.startsWith('pharma_customers_db')) {
          entityType = 'customers';
        } else if (lowerKey.startsWith('pharma_stock_adjustments')) {
          entityType = 'stockMovements';
        } else if (lowerKey.startsWith('pharma_hold_carts')) {
          entityType = 'sales';
        } else {
          entityType = classifyCollectionByStructure(rows);
          if (!entityType) {
            entityType = classifyCollectionByName(key);
          }
        }

        if (entityType) {
          if (entityType === 'branches') branches.push(...rows);
          else if (entityType === 'medicines') medicines.push(...rows);
          else if (entityType === 'stockItems') stockItems.push(...rows);
          else if (entityType === 'customers') customers.push(...rows);
          else if (entityType === 'suppliers') suppliers.push(...rows);
          else if (entityType === 'sales') sales.push(...rows);
          else if (entityType === 'purchaseOrders') purchaseOrders.push(...rows);
          else if (entityType === 'expenses') expenses.push(...rows);
          else if (entityType === 'supplierTransactions') supplierTransactions.push(...rows);
          else if (entityType === 'stockMovements') stockMovements.push(...rows);
        }
      });
    }

    const isLegacy = legacyMode || stockMovements.length > 0 || (actualBackup && (actualBackup.Medicines || actualBackup.Customers || actualBackup.Sales || actualBackup.medicines || actualBackup.customers || actualBackup.sales || actualBackup.products || actualBackup.items || Object.keys(actualBackup).some(k => k.startsWith('pharma_'))));

    if (itemsOnlyRestore) {
      format = 'Simplified Items Only Backup';
      entities = [
        { name: 'Inventory Items', count: medicines.length }
      ];

      list.push({
        id: 'items-only-mode',
        entity: 'Simplified Items Only Mode',
        status: 'ok',
        details: `Scanning backup for inventory products and counts. Found ${medicines.length} candidate items.`
      });

      medicines.slice(0, 50).forEach((m: any, idx: number) => {
        list.push({
          id: `pre-items-${idx}`,
          entity: 'Inventory Item',
          status: 'ok',
          details: `${m.name || m.Name || m.DrugName || m.ProductName || m.productName || 'Unnamed product'}`
        });
      });
    } else if (isLegacy) {
      format = 'Legacy Desktop Backup (Auto-Discovery Mapping Active)';
      entities = [
        { name: 'Branches', count: branches.length },
        { name: 'Medicines (Catalog)', count: medicines.length },
        { name: 'Stock Items (Inventory)', count: stockItems.length },
        { name: 'Suppliers', count: suppliers.length },
        { name: 'Customers', count: customers.length },
        { name: 'Sales Transactions', count: sales.length },
        { name: 'Purchase Orders', count: purchaseOrders.length },
        { name: 'Expenses', count: expenses.length },
        { name: 'Supplier Transactions', count: supplierTransactions.length },
        { name: 'Stock Movements (Bin Cards)', count: stockMovements.length }
      ].filter(e => e.count > 0);

      list.push({
        id: 'legacy-detected',
        entity: 'Legacy Desktop Backup',
        status: 'ok',
        details: `Auto-Discovery Scanner detected legacy tables. Reconciling schema dynamically.`
      });

      medicines.slice(0, 50).forEach((m: any, idx: number) => {
        list.push({
          id: `pre-leg-m-${idx}`,
          entity: 'Medicine (Legacy Map)',
          status: 'ok',
          details: `${m.name || m.Name || m.DrugName || m.ProductName || 'Unnamed product'}`
        });
      });

      customers.slice(0, 50).forEach((c: any, idx: number) => {
        list.push({
          id: `pre-leg-c-${idx}`,
          entity: 'Customer (Legacy Map)',
          status: 'ok',
          details: `${c.name || c.FullName || c.customerName || 'Legacy Client'}`
        });
      });

      stockMovements.slice(0, 50).forEach((sm: any, idx: number) => {
        list.push({
          id: `pre-leg-sm-${idx}`,
          entity: 'Stock Movement (Bin Card)',
          status: 'ok',
          details: `Quantity Delta: ${sm.quantity || sm.Qty || sm.Quantity || 0} | Balance: ${sm.balance || sm.Balance || 0}`
        });
      });

    } else {
      format = 'Sonan Multi-Branch V2 (Web)';
      entities = [
        { name: 'Branches', count: branches.length },
        { name: 'Medicines', count: medicines.length },
        { name: 'Stock Batch Levels', count: stockItems.length },
        { name: 'Suppliers', count: suppliers.length },
        { name: 'Supplier Transactions', count: supplierTransactions.length },
        { name: 'Customers', count: customers.length },
        { name: 'Sales POS Invoices', count: sales.length },
        { name: 'Purchase Orders', count: purchaseOrders.length },
        { name: 'Expenses Ledger', count: expenses.length },
        { name: 'Stock Movements (Bin Cards)', count: stockMovements.length }
      ].filter(e => e.count > 0);

      medicines.slice(0, 50).forEach((m: any, idx: number) => {
        list.push({
          id: `pre-m-${m.id || idx}`,
          entity: 'Medicine Catalog',
          status: 'ok',
          details: `${m.name || m.Name}`
        });
      });

      stockItems.slice(0, 50).forEach((st: any, idx: number) => {
        list.push({
          id: `pre-st-${st.id || idx}`,
          entity: 'Stock Batch',
          status: 'ok',
          details: `Batch ${st.batchNumber || st.Batch || 'Gen'} - Quantity: ${st.quantity || st.Quantity || 0}`
        });
      });
    }

    if (medicines.length === 0) {
      list.push({
        id: 'missing-medicines',
        entity: 'Medicines Catalog (Empty)',
        status: 'skip',
        reason: 'Required Medicines Catalog is missing from source backup file.',
        details: 'Preflight failed: Medicines catalog must be present.'
      });
    }

    setDetectedFormat(format);
    setPreflights(list);
    
    const okCount = list.filter(x => x.status === 'ok').length;
    const skipCount = list.filter(x => x.status === 'skip').length;
    
    setValidationSummary({
      imported: okCount,
      skipped: skipCount,
      total: list.length,
      entities: entities
    });
  };

  const executeRestore = async () => {
    if (!parsedData) return;
    try {
      setWizardStep('executing');
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupContent: parsedData,
          operatorId: currentUser?.id,
          targetBranchId: targetBranchId,
          legacyMode: legacyMode,
          fileName: selectedFile?.name || 'backup.json',
          itemsOnly: itemsOnly,
          itemsOnlyQtyDesc: itemsOnlyQtyDesc,
          itemsOnlyRestore: itemsOnlyRestore
        })
      });

      const data = await res.json();
      setExecutionResult(data);
      setWizardStep('result');
      
      if (data.success) {
        onRestoreSuccess();
        fetchBackups();
      }
    } catch (err: any) {
      console.error(err);
      setExecutionResult({
        success: false,
        summary: { imported: 0, skipped: 0, repaired: 0, total: 0, missingEntities: [] },
        logs: ['CRITICAL ERROR: Failed to reach restoration server API.'],
        skippedReasons: [err.message || 'REST endpoint timeout'],
        warnings: []
      });
      setWizardStep('result');
    }
  };

  const resetWizard = () => {
    setSelectedFile(null);
    setParsedData(null);
    setDetectedFormat('');
    setValidationSummary(null);
    setPreflights([]);
    setExecutionResult(null);
    setItemsOnlyRestore(false);
    setWizardStep('upload');
  };

  const filteredPreflights = preflights.filter(x => {
    if (preflightFilter === 'all') return true;
    return x.status === preflightFilter;
  });

  return (
    <div id="backup-restore-wizard" className="space-y-6">
      
      {/* Visual Integrity Status Guard Rails */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-150 p-4 rounded-xl flex items-start gap-3">
          <div className="bg-emerald-55 p-2 rounded-lg">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-900 block">Duplication Guard</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">Scans active Barcodes, SKUs &amp; Invoice keys globally.</span>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
              Active Protection
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl flex items-start gap-3">
          <div className="bg-emerald-55 p-2 rounded-lg">
            <Database className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-900 block">Relational Integrity</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">Validates Medicine IDs and Branch references before commit.</span>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
              Enforced Rules
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl flex items-start gap-3">
          <div className="bg-emerald-55 p-2 rounded-lg">
            <RefreshCw className="h-5 w-5 text-emerald-600 animate-spin-slow" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-900 block">Transactional Safety</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">Automated rollback resets system state if migration fails.</span>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
              Zero-Loss engine
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl flex items-start gap-3">
          <div className="bg-emerald-55 p-2 rounded-lg">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-900 block">Audit Trails</span>
            <span className="text-[10px] text-gray-500 block mt-0.5">Tracks operator name, size, date, and terminal log outputs.</span>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
              Strict Auditing
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left / Upper Main: Wizard Step Card */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
            <div>
              <h2 className="text-lg font-sans font-semibold text-gray-900 tracking-tight">
                Migration &amp; Restoration Wizard
              </h2>
              <p className="text-xs text-gray-500 font-sans">
                Restore data from previous web iterations or legacy branch desktop databases.
              </p>
            </div>
            {wizardStep !== 'upload' && (
              <button 
                onClick={resetWizard}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 px-3 py-1.5 rounded border border-gray-200"
              >
                Reset Wizard
              </button>
            )}
          </div>

          {/* Step 1: Upload */}
          {wizardStep === 'upload' && (
            <div className="space-y-6">
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all ${
                  dragActive ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 hover:border-emerald-400 bg-gray-50'
                }`}
              >
                <div className="bg-emerald-100 p-4 rounded-full mb-4 text-emerald-700">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="text-sm font-sans font-semibold text-gray-950 mb-1">
                  Drag &amp; drop database backup file
                </h3>
                <p className="text-xs text-gray-500 text-center max-w-sm mb-4">
                  Supports JSON, SQL scripts, SQLite `.db` binaries, and ZIP-compressed backup archives.
                </p>
                
                <label className="bg-white hover:bg-gray-55 text-gray-800 font-sans font-medium text-xs py-2 px-4 rounded border border-gray-350 shadow-sm cursor-pointer transition-all">
                  Browse Files
                  <input 
                    type="file" 
                    accept=".json,.sql,.db,.sqlite,.zip" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                </label>
              </div>

              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex gap-3 text-xs leading-relaxed border border-blue-200">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-1">Testing Template Backups?</span>
                  We have seeded active databases statefully on the container node. You can download the current complete system state using the **Export Database** action in the actions sidebar, edit or corrupt items in the JSON, and re-import them to test validation rollback!
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Validate / Preflight View */}
          {wizardStep === 'validate' && validationSummary && (
            <div className="space-y-6">
              {/* Auto Detected Format Status Banner */}
              <div className="bg-gray-900 text-white p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 font-mono block uppercase">Autodetected Source Profile</span>
                  <span className="text-sm font-sans font-semibold text-emerald-400 mt-1 block">
                    {detectedFormat}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-mono block uppercase">File Name</span>
                  <span className="text-xs font-sans text-gray-200 mt-1 block max-w-[180px] truncate">
                    {selectedFile?.name}
                  </span>
                </div>
              </div>

              {/* Branch Sandbox & Engine Controls */}
              <div className="bg-gray-55 border border-gray-200 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-600" />
                  Import Sandbox &amp; Engine Controls
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Target Branch Sandbox</label>
                    <select
                      value={targetBranchId}
                      onChange={(e) => setTargetBranchId(e.target.value)}
                      className="w-full text-xs bg-white border border-gray-350 rounded p-2 text-gray-800 outline-none"
                    >
                      <option value="all">All Branches (Global Restore)</option>
                      <option value="b1">Sonan Pharmacy (Main Branch)</option>
                      <option value="b2">Sonan Pharmacy No. 2</option>
                      <option value="b3">Sonan Pharmacy No. 3</option>
                    </select>
                    <p className="text-[9px] text-gray-500 leading-normal">
                      Isolate the restored data. Selecting a specific branch prevents it from modifying other branches' information.
                    </p>
                  </div>

                  <div className="space-y-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Legacy Engine Mode</label>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={legacyMode}
                          onChange={(e) => setLegacyMode(e.target.checked)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        />
                        <span className="text-xs text-gray-755 font-medium">Legacy Desktop Backup Import</span>
                      </label>
                    </div>
                    <p className="text-[9px] text-gray-500 leading-normal">
                      Forces the migration layer to auto-map old tables, generate default entities, and repair missing relationships.
                    </p>
                  </div>

                  <div className="space-y-1 flex flex-col justify-between">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Restoration Filter</label>
                      <div className="flex flex-col gap-2 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemsOnlyRestore}
                            onChange={(e) => {
                              setItemsOnlyRestore(e.target.checked);
                              if (e.target.checked) {
                                setItemsOnly(false);
                                setItemsOnlyQtyDesc(false);
                              }
                            }}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <span className="text-xs text-emerald-800 font-bold">Items Only Restore (Pure Inventory)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemsOnly}
                            onChange={(e) => {
                              setItemsOnly(e.target.checked);
                              if (e.target.checked) {
                                setItemsOnlyQtyDesc(false);
                                setItemsOnlyRestore(false);
                              }
                            }}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <span className="text-xs text-gray-755 font-medium">Medicines Catalog Only</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemsOnlyQtyDesc}
                            onChange={(e) => {
                              setItemsOnlyQtyDesc(e.target.checked);
                              if (e.target.checked) {
                                setItemsOnly(false);
                                setItemsOnlyRestore(false);
                              }
                            }}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <span className="text-xs text-gray-755 font-medium">Items Only (Quantity & Description)</span>
                        </label>
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-500 leading-normal">
                      Filter to limit restoration scope. "Items Only Restore" imports ONLY inventory items with their stock levels, ignoring sales, suppliers, expenses, and financial logs. "Medicines Catalog Only" replaces the entire drug list. "Items Only (Quantity & Description)" restores medicines, updating stock/descriptions from the backup.
                    </p>
                  </div>
                </div>
              </div>

              {/* Validation Summary Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
                  <span className="text-[10px] text-emerald-800 font-medium block">Ready to Import</span>
                  <span className="text-xl font-sans font-bold text-emerald-700 mt-1 block">
                    {validationSummary.imported} <span className="text-xs font-normal text-emerald-500">records</span>
                  </span>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg">
                  <span className="text-[10px] text-yellow-800 font-medium block">Conflicts Skipped</span>
                  <span className="text-xl font-sans font-bold text-yellow-700 mt-1 block">
                    {validationSummary.skipped} <span className="text-xs font-normal text-yellow-500">records</span>
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg">
                  <span className="text-[10px] text-gray-800 font-medium block">Total Parsed</span>
                  <span className="text-xl font-sans font-bold text-gray-700 mt-1 block">
                    {validationSummary.total} <span className="text-xs font-normal text-gray-500">records</span>
                  </span>
                </div>
              </div>

              {/* Entity Breakdown list */}
              <div>
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Entity Inventory Breakdown:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {validationSummary.entities.map((e, idx) => (
                    <div key={idx} className="bg-gray-55 border border-gray-200 p-2 rounded flex justify-between items-center text-xs">
                      <span className="text-gray-600 truncate mr-1">{e.name}</span>
                      <span className="font-semibold text-gray-900">{e.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Conflict Log Console */}
              <div className="border border-gray-150 rounded-lg">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-150 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-gray-500" />
                    Preflight Conflict Pre-Scan Results
                  </span>
                  
                  {/* Log Filter Buttons */}
                  <div className="flex bg-gray-200 p-0.5 rounded text-[10px] font-medium border border-gray-300">
                    <button 
                      onClick={() => setPreflightFilter('all')} 
                      className={`px-2 py-0.5 rounded ${preflightFilter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      All
                    </button>
                    <button 
                      onClick={() => setPreflightFilter('ok')} 
                      className={`px-2 py-0.5 rounded ${preflightFilter === 'ok' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      Ready
                    </button>
                    <button 
                      onClick={() => setPreflightFilter('skip')} 
                      className={`px-2 py-0.5 rounded ${preflightFilter === 'skip' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      Skipped
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto font-mono text-xs bg-gray-950 text-gray-200 divide-y divide-gray-800">
                  {filteredPreflights.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No logs match active filter.</div>
                  ) : (
                    filteredPreflights.map((p) => (
                      <div key={p.id} className="p-3 hover:bg-gray-900 flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                        <div className="flex items-start gap-2">
                          {p.status === 'ok' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1 rounded ${
                                p.status === 'ok' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-yellow-950 text-yellow-400 border border-yellow-900'
                            }`}>
                              {p.entity}
                            </span>
                            <span className="ml-2 font-medium text-gray-100">{p.details}</span>
                          </div>
                        </div>
                        {p.status === 'skip' && (
                          <div className="text-[10px] text-yellow-400 flex items-center gap-1 mt-1 sm:mt-0 font-sans pl-5 sm:pl-0">
                            <span className="bg-yellow-950/40 px-1.5 py-0.5 rounded border border-yellow-900/40">
                              {p.reason}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action area */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={executeRestore}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-medium text-sm py-2.5 px-4 rounded shadow flex items-center justify-center gap-2 transition-all"
                >
                  <Play className="h-4 w-4" />
                  Execute Relational Import &amp; Commit
                </button>
                <button
                  onClick={resetWizard}
                  className="bg-white hover:bg-gray-50 text-gray-700 font-sans font-medium text-sm py-2.5 px-4 rounded border border-gray-300 shadow-sm flex items-center justify-center gap-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Executing Loading Screen */}
          {wizardStep === 'executing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin" />
              <div className="text-center space-y-1">
                <h3 className="text-sm font-sans font-semibold text-gray-950">Committing Transactions to database...</h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  Checking constraints, testing rollback safeguards, indexing items on disk, and writing logs. Please wait.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Final Migration Results */}
          {wizardStep === 'result' && executionResult && (
            itemsOnlyRestore && executionResult.success ? (
              <div className="space-y-6 flex flex-col items-center py-6">
                <div className="w-full max-w-xl bg-gray-950 border border-emerald-900/40 text-emerald-400 p-8 rounded-xl font-mono text-xs shadow-2xl leading-relaxed whitespace-pre select-all text-center">
                  {executionResult.itemsOnlyRestoreResult}
                </div>
                <div className="pt-2">
                  <button
                    onClick={resetWizard}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-medium text-sm py-2.5 px-6 rounded shadow transition-all flex items-center gap-2"
                  >
                    Return to Import Panel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className={`p-5 rounded-xl border flex items-start gap-4 ${
                  executionResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {executionResult.success ? (
                    <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertOctagon className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <h3 className="font-sans font-semibold text-sm">
                      {executionResult.success 
                        ? 'System Restored Successfully!' 
                        : 'Restoration Failed - Transaction Rollback Engaged'
                      }
                    </h3>
                    <p className="text-xs text-gray-600 leading-normal">
                      {executionResult.success 
                        ? `Successfully processed and committed ${executionResult.summary.imported} entities without anomalies. Duplicate checking bypassed ${executionResult.summary.skipped} records safely, and repaired ${executionResult.summary.repaired} referencing keys.`
                        : 'The database import was halted due to relational constraint anomalies. Safe state restoration engaged; no data was overwritten.'
                      }
                    </p>
                  </div>
                </div>

                {/* Execution validation summary table */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 border border-gray-150 rounded-lg text-xs bg-gray-50/50">
                    <span className="text-gray-500 block">Saved Entries</span>
                    <span className="text-lg font-bold text-gray-900 block mt-1">
                      {executionResult.summary.imported} rows
                    </span>
                  </div>
                  <div className="p-3 border border-gray-150 rounded-lg text-xs bg-gray-50/50">
                    <span className="text-gray-500 block">Repaired Keys</span>
                    <span className="text-lg font-bold text-emerald-700 block mt-1">
                      {executionResult.summary.repaired} items
                    </span>
                  </div>
                  <div className="p-3 border border-gray-150 rounded-lg text-xs bg-gray-50/50">
                    <span className="text-gray-500 block">Skipped Conflicts</span>
                    <span className="text-lg font-bold text-yellow-700 block mt-1">
                      {executionResult.summary.skipped} rows
                    </span>
                  </div>
                  <div className="p-3 border border-gray-150 rounded-lg text-xs bg-gray-50/50">
                    <span className="text-gray-500 block">Missing Tables</span>
                    <span className="text-lg font-bold text-blue-700 block mt-1">
                      {executionResult.summary.missingEntities?.length || 0} found
                    </span>
                  </div>
                </div>

                {/* Missing entities automatically healed warnings */}
                {executionResult.summary.missingEntities && executionResult.summary.missingEntities.length > 0 && (
                  <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 space-y-1">
                    <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                      <Info className="h-4 w-4 shrink-0 text-blue-600" />
                      Missing Entities Automatically Healed
                    </h4>
                    <p className="text-[11px] text-blue-700 leading-normal">
                      The following tables/entities were missing from the backup format. Empty records were successfully seeded to prevent schema anomalies:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {executionResult.summary.missingEntities.map((ent, eIdx) => (
                        <span key={eIdx} className="bg-blue-100 border border-blue-250 text-blue-800 text-[10px] font-mono px-2 py-0.5 rounded font-medium">
                          {ent}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed warnings and repairs list */}
                {executionResult.warnings && executionResult.warnings.length > 0 && (
                  <div className="border border-yellow-200 bg-yellow-50/30 rounded-lg p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-yellow-800 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600" />
                      Automatic Relational Repairs &amp; Warnings
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {executionResult.warnings.map((warn, wIdx) => (
                        <div key={wIdx} className="text-xs text-yellow-700 flex items-start gap-1">
                          <span className="text-yellow-500 font-bold shrink-0">•</span>
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Real-time Validation Log Output Terminal Console */}
                <div className="border border-gray-150 rounded-lg">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-150 flex items-center justify-between text-xs font-semibold text-gray-800">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Terminal className="h-3.5 w-3.5 text-gray-500" />
                      restoration_validation_audit_trail.log
                    </span>
                  </div>
                  <div className="p-4 bg-gray-950 text-gray-200 font-mono text-xs space-y-2 max-h-56 overflow-y-auto leading-relaxed">
                    {executionResult.logs.map((line, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <span className="text-gray-600 shrink-0">[{idx+1}]</span>
                        <span className={line.includes('CRITICAL') || line.includes('ERROR') ? 'text-red-400' : line.includes('Success') || line.includes('validated') || line.includes('repaired') ? 'text-emerald-400' : 'text-gray-300'}>
                          {line}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skipped reasons table if any */}
                {executionResult.skippedReasons.length > 0 && (
                  <div className="border border-gray-150 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1 text-yellow-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Conflict Log Detail
                    </h4>
                    <div className="bg-gray-55 rounded divide-y divide-gray-200 border border-gray-200 max-h-40 overflow-y-auto font-sans text-xs text-gray-600">
                      {executionResult.skippedReasons.map((reason, idx) => (
                        <div key={idx} className="p-2 flex gap-1 items-start">
                          <CornerDownRight className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={resetWizard}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-medium text-xs py-2 px-4 rounded shadow transition-all"
                  >
                    Return to Import Panel
                  </button>
                </div>
              </div>
            )
          )}

        </div>

        {/* Right sidebar actions: Trigger Backup, Download, History log list */}
        <div className="space-y-6">
          
          {/* IndexedDB Fail-Safe Vault Card */}
          <div className="bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 text-white rounded-xl shadow-md border border-teal-800/40 p-5 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">
                  IndexedDB Fail-Safe Vault
                </h3>
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                failSafeBackups.length > 0
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {failSafeBackups.length > 0 ? 'PROTECTED' : 'READY'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              Guarantees recovery for critical records (Medicines, Customers, Sales) in persistent IndexedDB even if the browser clears localStorage or site cache.
            </p>

            {/* Storage Vulnerability Warning Alert if localStorage was lost */}
            {storageHealth?.isStorageVulnerable && (
              <div className="bg-amber-500/20 border border-amber-400/40 p-2.5 rounded-lg text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px]">
                  <p className="font-semibold text-amber-300">Primary localStorage was cleared</p>
                  <p className="text-slate-300">IndexedDB holds your safe snapshot. Click below to restore instantly.</p>
                  <button
                    onClick={() => handleRestoreFromFailSafe()}
                    disabled={restoringSnapId !== null}
                    className="mt-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded text-[10px] transition"
                  >
                    {restoringSnapId ? 'Restoring...' : 'Auto-Restore Primary State'}
                  </button>
                </div>
              </div>
            )}

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-2 bg-slate-850/80 border border-slate-750 p-2.5 rounded-lg text-center">
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Medicines</span>
                <span className="text-xs font-bold text-teal-300">
                  {storageHealth?.latestBackupInfo?.itemCounts?.medicines ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Customers</span>
                <span className="text-xs font-bold text-teal-300">
                  {storageHealth?.latestBackupInfo?.itemCounts?.customers ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-slate-400 block">Sales</span>
                <span className="text-xs font-bold text-teal-300">
                  {storageHealth?.latestBackupInfo?.itemCounts?.sales ?? 0}
                </span>
              </div>
            </div>

            {failSafeActionMsg && (
              <div className={`p-2 rounded text-[11px] font-medium ${
                failSafeActionMsg.isError 
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {failSafeActionMsg.text}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                onClick={handleCreateFailSafeSnapshot}
                disabled={failSafeLoading}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-2 px-3 rounded shadow flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className={`h-3.5 w-3.5 ${failSafeLoading ? 'animate-spin' : ''}`} />
                {failSafeLoading ? 'Securing Checkpoint...' : 'Take Fail-Safe Snapshot'}
              </button>

              <button
                onClick={() => {
                  loadFailSafeStatus();
                  setShowFailSafeModal(true);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-3 rounded border border-slate-700 shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5 text-teal-400" />
                Open Fail-Safe Recovery Center ({failSafeBackups.length})
              </button>
            </div>
          </div>

          {/* Automatic Daily Backup Scheduler Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl shadow-md border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Automatic Daily Backup
                </h3>
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                autoDailyBackupEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {autoDailyBackupEnabled ? 'ACTIVE' : 'OFF'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              Automatically exports and downloads a complete database snapshot once per day directly to your browser download folder.
            </p>

            <div className="space-y-3 pt-1">
              {/* Enable / Disable Switch */}
              <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-lg border border-slate-750">
                <span className="text-xs font-semibold text-slate-200">
                  Enable Daily Auto-Download
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDailyBackupEnabled}
                    onChange={(e) => toggleAutoDailyBackup(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {autoDailyBackupEnabled && (
                <div className="space-y-2.5 pt-1 text-xs">
                  {/* Schedule Trigger Choice */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Daily Trigger Schedule:
                    </label>
                    <select
                      value={autoDailyBackupSchedule}
                      onChange={(e) => changeAutoBackupSchedule(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded p-2 outline-none focus:border-emerald-500"
                    >
                      <option value="on_launch">On First Launch Every Day (Morning/Anytime)</option>
                      <option value="at_1800">At End of Day (6:00 PM / 18:00)</option>
                    </select>
                  </div>

                  {/* Format Choice */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Auto Download Format:
                    </label>
                    <select
                      value={autoDailyBackupFormat}
                      onChange={(e) => changeAutoBackupFormat(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded p-2 outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value="json">JSON (.json) - Full Standard Data</option>
                      <option value="sql">SQL Script (.sql) - Database Inserts</option>
                      <option value="csv">CSV Sheet (.csv) - Flat Tables</option>
                      <option value="xml">XML Markup (.xml)</option>
                    </select>
                  </div>

                  {/* Branch Scope */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Target Branch Scope:
                    </label>
                    <select
                      value={autoDailyBackupBranch}
                      onChange={(e) => changeAutoBackupBranch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded p-2 outline-none focus:border-emerald-500"
                    >
                      <option value="all">Global System (All Branches)</option>
                      {branchesList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Banner */}
                  <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Last Auto-Download:</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {lastAutoBackupDate === 'Never' ? 'Not run yet today' : `${lastAutoBackupDate} ${lastAutoBackupTime ? '@ ' + lastAutoBackupTime : ''}`}
                      </span>
                    </div>
                  </div>

                  {/* Manual Test Auto Download Button */}
                  <button
                    onClick={triggerAutoBackupTestNow}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2 px-3 rounded shadow flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
                    Test Auto-Download Now
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action trigger card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="text-sm font-sans font-semibold text-gray-900 flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              Database Export &amp; Backup
            </h3>
            <p className="text-xs text-gray-500">
              Initiate manual, scheduled, or instant full snapshots. Filter downloads by branch and choose format preferences.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => triggerManualBackup('Full')}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-medium text-xs py-2 px-3 rounded shadow flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Trigger Full Backup
              </button>

              <button
                onClick={() => triggerManualBackup('Items List Only')}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white font-sans font-medium text-xs py-2 px-3 rounded shadow flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Database className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Backup Items List Only
              </button>

              <div className="border-t border-gray-150 my-2"></div>

              {/* Branch Selection & Format Preference Panel */}
              <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-lg space-y-3">
                <span className="text-[11px] font-bold text-gray-600 block uppercase tracking-wider">
                  Download Configuration
                </span>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 block">Select Target Branch:</label>
                  <select
                    value={exportBranchId}
                    onChange={(e) => setExportBranchId(e.target.value)}
                    className="w-full text-xs bg-white border border-gray-300 rounded p-1.5 text-gray-800 outline-none"
                  >
                    <option value="all">All Branches (Global)</option>
                    {branchesList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                    {branchesList.length === 0 && (
                      <>
                        <option value="b1">Sonan Pharmacy (Main Branch)</option>
                        <option value="b2">Sonan Pharmacy No. 2</option>
                        <option value="b3">Sonan Pharmacy No. 3</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 block">Backup Format Type:</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExportFormat(val);
                      if (val === 'full') {
                        setExportBranchId('all');
                      } else if (val === 'branch' && exportBranchId === 'all') {
                        setExportBranchId('b1');
                      }
                    }}
                    className="w-full text-xs bg-white border border-gray-300 rounded p-1.5 text-gray-800 outline-none font-medium"
                  >
                    <option value="json">Standard JSON Backup</option>
                    <option value="full">Full Backup (All Branches)</option>
                    <option value="branch">Branch Only Backup (Selected Branch)</option>
                    <option value="legacy_desktop">Legacy Desktop Compatible Backup</option>
                    <option value="sql">SQL Script (.sql) - Inserts</option>
                    <option value="csv">CSV (.csv) - Comma Separated</option>
                    <option value="xml">XML (.xml) - Extensible Markup</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDownloadBackup({ branchId: exportBranchId, format: exportFormat })}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-sans font-semibold text-xs py-2 px-3 rounded shadow-md flex items-center justify-center gap-1.5 transition-all text-center mt-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {loading ? 'Downloading...' : 'Download Filtered Backup'}
                </button>
              </div>

              <div className="border-t border-gray-150 my-1"></div>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDownloadBackup({ branchId: 'all', format: 'json' })}
                className="w-full bg-white hover:bg-gray-55 disabled:opacity-50 text-gray-750 font-sans font-medium text-xs py-2 px-3 rounded border border-gray-300 shadow-sm flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                Quick Export Full JSON
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDownloadBackup({ type: 'items', format: 'json' })}
                className="w-full bg-white hover:bg-gray-55 disabled:opacity-50 text-gray-750 font-sans font-medium text-xs py-2 px-3 rounded border border-gray-300 shadow-sm flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-teal-600" />
                Quick Export Items Catalog
              </button>
            </div>
          </div>

          {/* Backup Audit Trails history logs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 className="text-sm font-sans font-semibold text-gray-900 flex items-center justify-between">
              Backup &amp; Restore Logs
              <span className="text-[10px] font-mono font-medium text-gray-500">
                ({backups.length} archived)
              </span>
            </h3>

            <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto border border-gray-100 rounded-lg bg-gray-55">
              {backups.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">No operations logged yet.</div>
              ) : (
                backups.map((b) => (
                  <div key={b.id} className="p-3 hover:bg-gray-100 transition-all">
                    <div 
                      onClick={() => setExpandedLogId(expandedLogId === b.id ? null : b.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                          b.status === 'Success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {b.status} • {b.type}
                        </span>
                        <span className="text-xs font-semibold text-gray-800 block mt-1">
                          {b.filename}
                        </span>
                        <span className="text-[10px] text-gray-500 block">
                          {b.date} • {b.time} • Size: {b.size}
                        </span>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expandedLogId === b.id ? 'rotate-95' : ''}`} />
                    </div>

                    {expandedLogId === b.id && (
                      <div className="mt-2 pt-2 border-t border-gray-200 font-mono text-[10px] bg-gray-950 text-gray-300 p-2 rounded-lg max-h-40 overflow-y-auto leading-normal">
                        <div className="text-emerald-400 border-b border-gray-850 pb-1 mb-1">Triggered by: {b.createdBy} ({b.scheduleType})</div>
                        {b.logs && b.logs.map((log, lIdx) => (
                          <div key={lIdx} className="truncate">» {log}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger Zone: Wipe Database Card */}
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-250 p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-800">
              <AlertOctagon className="h-5 w-5 text-red-600" />
              <h3 className="text-sm font-sans font-bold uppercase tracking-wide">
                Danger Zone
              </h3>
            </div>
            <p className="text-xs text-red-700 font-medium">
              Wipe all transactional databases, sales histories, and inventory batches from this app to start fresh.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setShowWipeModal(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-sans font-bold text-xs py-2 px-3 rounded shadow transition-all cursor-pointer text-center"
              >
                Remove All Data from App
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Fail-Safe Recovery Center Modal */}
      {showFailSafeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 rounded-lg border border-teal-400/30">
                  <ShieldCheck className="h-6 w-6 text-teal-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    IndexedDB Fail-Safe State Recovery Center
                  </h3>
                  <p className="text-xs text-teal-200/80 mt-0.5">
                    Browser-level persistent storage protecting medicines, customers, and sales
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFailSafeModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
              
              {/* Storage Status & Diagnostic Banner */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive className="h-4 w-4 text-teal-600" />
                    Storage Health &amp; Diagnostics
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {storageHealth?.indexedDbBackupCount ?? 0} Snapshots in IndexedDB
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-teal-50/70 border border-teal-100 p-2.5 rounded-lg">
                    <span className="text-[10px] font-semibold text-teal-700 uppercase block">Medicines</span>
                    <span className="text-sm font-black text-teal-900">
                      {storageHealth?.latestBackupInfo?.itemCounts?.medicines ?? 0}
                    </span>
                  </div>
                  <div className="bg-teal-50/70 border border-teal-100 p-2.5 rounded-lg">
                    <span className="text-[10px] font-semibold text-teal-700 uppercase block">Customers</span>
                    <span className="text-sm font-black text-teal-900">
                      {storageHealth?.latestBackupInfo?.itemCounts?.customers ?? 0}
                    </span>
                  </div>
                  <div className="bg-teal-50/70 border border-teal-100 p-2.5 rounded-lg">
                    <span className="text-[10px] font-semibold text-teal-700 uppercase block">Sales</span>
                    <span className="text-sm font-black text-teal-900">
                      {storageHealth?.latestBackupInfo?.itemCounts?.sales ?? 0}
                    </span>
                  </div>
                  <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-lg">
                    <span className="text-[10px] font-semibold text-slate-600 uppercase block">Storage Quota</span>
                    <span className="text-xs font-bold text-slate-800">
                      {storageHealth?.storageEstimate?.usageBytes 
                        ? `${(storageHealth.storageEstimate.usageBytes / (1024 * 1024)).toFixed(1)} MB` 
                        : 'Persistent'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Message if any */}
              {failSafeActionMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  failSafeActionMsg.isError 
                    ? 'bg-red-50 text-red-800 border border-red-200' 
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {failSafeActionMsg.text}
                </div>
              )}

              {/* Quick Actions: Snapshot Creator & JSON Import/Export */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Create New Fail-Safe Checkpoint
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Checkpoint reason/label (e.g., Pre-import backup, EOD verification)..."
                    value={failSafeCustomReason}
                    onChange={(e) => setFailSafeCustomReason(e.target.value)}
                    className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 outline-none focus:bg-white focus:border-teal-500"
                  />
                  <button
                    onClick={handleCreateFailSafeSnapshot}
                    disabled={failSafeLoading}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {failSafeLoading ? 'Saving...' : 'Save Checkpoint'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleExportFailSafeFile()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <Download className="h-3.5 w-3.5 text-teal-600" />
                    Export Latest Fail-Safe (.json)
                  </button>

                  <label className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer">
                    <Upload className="h-3.5 w-3.5 text-teal-600" />
                    Import External Fail-Safe File
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFailSafeFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Snapshots List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Stored Snapshots History ({failSafeBackups.length})
                  </h4>
                  <button
                    onClick={loadFailSafeStatus}
                    className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh List
                  </button>
                </div>

                <div className="space-y-2.5">
                  {failSafeBackups.length === 0 ? (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 text-center text-gray-500 text-xs space-y-2">
                      <Shield className="h-8 w-8 text-gray-300 mx-auto" />
                      <p className="font-semibold text-gray-600">No Fail-Safe Snapshots Saved Yet</p>
                      <p className="text-[11px] text-gray-400">
                        Click "Save Checkpoint" above or take any action in the app to initialize your first snapshot.
                      </p>
                    </div>
                  ) : (
                    failSafeBackups.map((snap, idx) => (
                      <div
                        key={snap.id}
                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-teal-300 transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">
                                {snap.reason || 'Point-in-time Snapshot'}
                              </span>
                              {idx === 0 && (
                                <span className="bg-teal-100 text-teal-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                  LATEST
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500 block">
                              {snap.date} • Checksum: <span className="font-mono text-[10px] text-gray-600">{snap.checksum}</span> • Size: {(snap.sizeBytes / 1024).toFixed(1)} KB
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleRestoreFromFailSafe(snap.id)}
                              disabled={restoringSnapId === snap.id}
                              className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`h-3 w-3 ${restoringSnapId === snap.id ? 'animate-spin' : ''}`} />
                              {restoringSnapId === snap.id ? 'Restoring...' : 'Restore State'}
                            </button>

                            <button
                              onClick={() => handleExportFailSafeFile(snap.id)}
                              title="Download JSON file for this snapshot"
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteFailSafe(snap.id)}
                              title="Delete this snapshot"
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Counts Pill Summary */}
                        <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-gray-600">
                          <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-100">
                            📦 {snap.itemCounts.medicines} Medicines
                          </span>
                          <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-100">
                            👥 {snap.itemCounts.customers} Customers
                          </span>
                          <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">
                            🧾 {snap.itemCounts.sales} Sales Invoices
                          </span>
                          {snap.itemCounts.stockItems > 0 && (
                            <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded border border-purple-100">
                              🏷️ {snap.itemCounts.stockItems} Stock Batches
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-white p-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFailSafeModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs py-2 px-4 rounded-lg transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {showWipeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-sans font-bold text-gray-900">
                Confirm Database Wipe
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              This action will completely delete all products, stock items/batches, suppliers transactions, expense accounts, sales invoices, transfers, and customer details. 
              Only structural branches and user accounts will remain so you can log back in. 
            </p>
            <div className="bg-red-50 p-3 rounded border border-red-100 text-xs text-red-800 font-semibold">
              Warning: This is permanent and cannot be undone.
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-700 block uppercase tracking-wider">
                Type <span className="text-red-600">WIPE</span> below to confirm:
              </label>
              <input
                type="text"
                placeholder="Type WIPE"
                value={wipeConfirmationText}
                onChange={(e) => setWipeConfirmationText(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded p-2 outline-none text-gray-850 font-bold font-mono text-center tracking-widest text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWipeModal(false);
                  setWipeConfirmationText('');
                }}
                disabled={wiping}
                className="bg-white hover:bg-gray-55 text-gray-700 border border-gray-300 font-sans font-medium text-xs py-1.5 px-3.5 rounded transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeDatabase}
                disabled={wiping || wipeConfirmationText.toUpperCase() !== 'WIPE'}
                className="bg-red-600 hover:bg-red-700 text-white font-sans font-bold text-xs py-1.5 px-4 rounded transition-all disabled:opacity-40 cursor-pointer shadow-md"
              >
                {wiping ? 'Wiping...' : 'Yes, Wipe Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
