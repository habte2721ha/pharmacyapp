import React, { useState, useEffect } from 'react';
import { 
  Building, LogOut, Shield, Database, LayoutDashboard, 
  ShoppingCart, Package, ArrowRightLeft, FileCheck, Users, 
  Wallet, ShieldAlert, BookOpen, User, Lock, CheckCircle2, 
  RefreshCw, RefreshCcw, Landmark, UserCheck, MapPin, History,
  Sun, Moon, CreditCard, Receipt, Menu, X, Mic, LayoutGrid,
  ChevronLeft, ChevronRight, Eye, EyeOff, Key, ShoppingBag,
  Share2, Copy, Check, ExternalLink, MessageSquare, Send, Mail, QrCode, Globe, Printer, Sparkles, Stethoscope,
  FolderTree, Video, PhoneCall, PhoneIncoming, Bell, PhoneOff, Volume2, VolumeX, PhoneForwarded
} from 'lucide-react';
import QRCode from 'qrcode';

import { offlineManager } from './utils/offlineManager.ts';
import { playIncomingCallChime } from './utils/teleconsultWebrtc.ts';
import EnterpriseDashboard from './components/EnterpriseDashboard.tsx';
import PosTerminal from './components/PosTerminal.tsx';
import InventoryManager from './components/InventoryManager.tsx';
import BinCardsPanel from './components/BinCardsPanel.tsx';
import SystemDocs from './components/SystemDocs.tsx';
import BackupRestoreWizard from './components/BackupRestoreWizard.tsx';
import SalesHistoryPanel from './components/SalesHistoryPanel.tsx';
import PharmacyNotes from './components/PharmacyNotes.tsx';
import VoiceAssistancePanel from './components/VoiceAssistancePanel.tsx';
import PublicCustomerStore from './components/PublicCustomerStore.tsx';
import OnlineOrdersPanel from './components/OnlineOrdersPanel.tsx';
import TeleconsultationManager from './components/TeleconsultationManager.tsx';
import { AutoBackupManager } from './components/AutoBackupManager.tsx';
import CategoryManagerPanel from './components/CategoryManagerPanel.tsx';

import { 
  StockTransferPanel, PurchaseManagerPanel, CustomerManagerPanel, 
  FinancialManagerPanel, UserActivityPanel, ExpenseRegistryPanel 
} from './components/EnterpriseModules.tsx';

import { 
  Branch, User as UserType, Medicine, StockItem, Supplier, 
  PurchaseOrder, StockTransfer, Customer, Expense, Sale, AuditLog,
  PharmacyNote, UserRole, ProductCategory
} from './types.ts';

export default function App() {
  // Theme state: 'light' | 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sonan-pharmacy-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  });

  // Global Font Size scale state
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(() => {
    const saved = localStorage.getItem('sonan-pharmacy-fontsize');
    if (saved === 'sm' || saved === 'base' || saved === 'lg' || saved === 'xl') return saved;
    return 'base';
  });

  // Mobile navigation drawer toggle state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Offline/Online synchronization states
  const [isOffline, setIsOffline] = useState(offlineManager.isOffline());
  const [isSimulated, setIsSimulated] = useState(offlineManager.isSimulated());
  const [pendingSyncCount, setPendingSyncCount] = useState(offlineManager.getQueue().length);
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sonan-pharmacy-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sonan-pharmacy-fontsize', fontSize);
  }, [fontSize]);

  // Session Authentication state (Strictly tab-isolated to allow different accounts in different browser tabs)
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    try {
      const sessionStored = sessionStorage.getItem('sonan_current_user');
      if (sessionStored) {
        return JSON.parse(sessionStored);
      }
      const localStored = localStorage.getItem('sonan_current_user');
      if (localStored) {
        const parsed = JSON.parse(localStored);
        if (parsed) {
          sessionStorage.setItem('sonan_current_user', localStored);
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const currentUserRef = React.useRef<UserType | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) {
      try {
        sessionStorage.setItem('sonan_current_user', JSON.stringify(currentUser));
        localStorage.setItem('sonan_current_user', JSON.stringify(currentUser));
      } catch {}
    }
  }, [currentUser]);

  const [usernameInput, setUsernameInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('admin123');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  
  // Device Recognition OTP verification states
  const [showDeviceOtpModal, setShowDeviceOtpModal] = useState(false);
  const [deviceOtpUser, setDeviceOtpUser] = useState<UserType | null>(null);
  const [deviceOtpId, setDeviceOtpId] = useState('');
  const [deviceOtpCode, setDeviceOtpCode] = useState('');
  const [deviceOtpError, setDeviceOtpError] = useState('');
  const [otpSentTo, setOtpSentTo] = useState<{ email: string; phone: string } | null>(null);
  const [showRevealedOtpInModal, setShowRevealedOtpInModal] = useState(false);
  const [fetchedPendingOtp, setFetchedPendingOtp] = useState<string | null>(null);

  // ERP Database collections
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pharmacyNotes, setPharmacyNotes] = useState<PharmacyNote[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  // System Loading state
  const [loadingDb, setLoadingDb] = useState(false);
  
  // Navigation State (Strictly isolated from background data sync cycles and per-tab navigation)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const sessionSaved = sessionStorage.getItem('sonan_active_tab');
    if (sessionSaved) return sessionSaved;
    const saved = localStorage.getItem('sonan_active_tab');
    if (saved) return saved;
    const storedUser = sessionStorage.getItem('sonan_current_user') || localStorage.getItem('sonan_current_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        return u.role === 'Cashier' ? 'pos' : 'dashboard';
      } catch {}
    }
    return 'dashboard';
  });

  // Dedicated safe navigation handler to guarantee instant persistence and atomic tab transitions
  const handleTabChange = React.useCallback((nextTab: string) => {
    if (!nextTab) return;
    setActiveTab(nextTab);
    try {
      sessionStorage.setItem('sonan_active_tab', nextTab);
      localStorage.setItem('sonan_active_tab', nextTab);
    } catch (e) {
      console.error('Failed to persist active tab:', e);
    }
  }, []);

  // Sync state changes to storage
  useEffect(() => {
    if (activeTab) {
      try {
        sessionStorage.setItem('sonan_active_tab', activeTab);
      } catch {}
    }
  }, [activeTab]);
  const [pendingOnlineOrderToPos, setPendingOnlineOrderToPos] = useState<any | null>(null);
  const [isPublicStoreMode, setIsPublicStoreMode] = useState<boolean>(() => {
    return window.location.search.includes('view=catalog') || window.location.search.includes('store=1');
  });
  const [showAllMaximize, setShowAllMaximize] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sonan-pharmacy-sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sonan-pharmacy-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Super Admin view filter context
  const [activeBranchContext, setActiveBranchContext] = useState<string>('all');
  const currentBranch = branches.find(b => b.id === activeBranchContext) || branches[0];

  // Real-time Teleconsultation Customer Call / Chat Alerts
  const [queuedTeleCount, setQueuedTeleCount] = useState<number>(0);
  const [incomingTeleAlertSession, setIncomingTeleAlertSession] = useState<any | null>(null);
  const [targetTeleSessionId, setTargetTeleSessionId] = useState<string | null>(null);
  const [callRingingSeconds, setCallRingingSeconds] = useState<number>(0);
  const [isCallRingingMuted, setIsCallRingingMuted] = useState<boolean>(false);
  const [copiedCallerPhone, setCopiedCallerPhone] = useState<boolean>(false);
  const seenTeleIdsRef = React.useRef<Set<string>>(new Set());

  // Share Customer Store Link Modal state in App
  const [showAppShareModal, setShowAppShareModal] = useState(false);
  const [appCopiedLink, setAppCopiedLink] = useState(false);
  const [appQrUrl, setAppQrUrl] = useState('');
  const [appShareBranch, setAppShareBranch] = useState('all');

  const getAppStoreUrl = (branchId?: string) => {
    const targetBranch = branchId || appShareBranch;
    const baseUrl = `${window.location.origin}${window.location.pathname}?view=catalog`;
    if (targetBranch && targetBranch !== 'all') {
      return `${baseUrl}&branchId=${targetBranch}`;
    }
    return baseUrl;
  };

  const handleCopyAppStoreLink = (branchId?: string) => {
    const url = getAppStoreUrl(branchId);
    navigator.clipboard.writeText(url);
    setAppCopiedLink(true);
    setTimeout(() => setAppCopiedLink(false), 2500);
  };

  const handleOpenAppShareModal = async () => {
    const url = getAppStoreUrl();
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 360,
        margin: 2,
        color: { dark: '#064e3b', light: '#ffffff' }
      });
      setAppQrUrl(dataUrl);
      setShowAppShareModal(true);
    } catch (e) {
      console.error(e);
      setShowAppShareModal(true);
    }
  };

  const shareAppStoreToPlatform = (platform: 'whatsapp' | 'telegram' | 'facebook' | 'twitter' | 'email') => {
    const url = getAppStoreUrl();
    const branchObj = branches.find(b => b.id === appShareBranch);
    const branchSuffix = branchObj ? ` (${branchObj.name} Branch)` : '';
    const text = `🛍️ Order medicines & cosmetics online${branchSuffix}! Fast home delivery:`;

    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'email') {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('Online Pharmacy Catalog')}&body=${encodeURIComponent(text + '\n' + url)}`, '_blank');
    }
  };

  // Helper check for role based access lists across any user instance
  const canAccessTabForUser = (tabId: string, user: UserType | null): boolean => {
    if (!user) return false;
    const roleStr = String(user.role);
    const perms: string[] = user.permissions || [];

    if (roleStr === 'Super Administrator' || roleStr === 'Admin' || roleStr === 'Administrator' || roleStr === 'Auditor') return true;

    switch (tabId) {
      case 'dashboard':
        return roleStr !== 'Cashier' || perms.includes('report') || perms.includes('dashboard');
      case 'pos':
        return roleStr === 'Cashier' || roleStr === 'Pharmacist' || roleStr === 'Branch Manager' || perms.includes('post') || perms.includes('pos');
      case 'inventory':
        return roleStr === 'Pharmacist' || roleStr === 'Store Keeper' || roleStr === 'Branch Manager' || perms.includes('inventory') || perms.includes('iteam add');
      case 'categories':
        return roleStr === 'Super Administrator' || roleStr === 'Admin' || roleStr === 'Administrator' || roleStr === 'Auditor' || roleStr === 'Pharmacist' || roleStr === 'Store Keeper' || roleStr === 'Branch Manager' || perms.includes('categories') || perms.includes('admin') || perms.includes('inventory');
      case 'bincards':
        return roleStr === 'Pharmacist' || roleStr === 'Store Keeper' || roleStr === 'Branch Manager' || perms.includes('bincards') || perms.includes('bin card');
      case 'transfers':
        return roleStr === 'Pharmacist' || roleStr === 'Store Keeper' || roleStr === 'Branch Manager' || perms.includes('transfer');
      case 'purchases':
        return roleStr === 'Store Keeper' || roleStr === 'Branch Manager' || roleStr === 'Accountant' || perms.includes('purchases') || perms.includes('purchase');
      case 'credit-ledger':
        return roleStr === 'Branch Manager' || roleStr === 'Pharmacist' || roleStr === 'Accountant' || perms.includes('credit-ledger') || perms.includes('credit');
      case 'expenses':
        return roleStr === 'Branch Manager' || roleStr === 'Pharmacist' || roleStr === 'Accountant' || perms.includes('expenses') || perms.includes('expense');
      case 'customers':
        return roleStr === 'Cashier' || roleStr === 'Pharmacist' || roleStr === 'Branch Manager' || roleStr === 'Accountant' || perms.includes('customers') || perms.includes('customer');
      case 'finances':
        return roleStr === 'Accountant' || roleStr === 'Branch Manager' || perms.includes('report generation') || perms.includes('finances') || perms.includes('report');
      case 'sales-history':
        return true; // Accessible to all roles with system access
      case 'teleconsultation':
        return true; // Pharmacists & clinical staff
      case 'online-orders':
        return true;
      case 'voice-assistance':
        return true;
      case 'admin':
        return roleStr === 'Super Administrator' || roleStr === 'Admin' || perms.includes('security_alerts') || perms.includes('security') || perms.includes('admin') || perms.includes('audit');
      case 'backup':
        return roleStr === 'Super Administrator' || roleStr === 'Admin' || perms.includes('backup');
      case 'docs':
        return roleStr === 'Super Administrator' || roleStr === 'Admin';
      default:
        return true;
    }
  };

  const canAccessTab = (tabId: string): boolean => {
    return canAccessTabForUser(tabId, currentUser);
  };

  // Ref to track user account identity and prevent background syncs from resetting navigation
  const lastAuthenticatedUserIdRef = React.useRef<string | null>(currentUser?.id || null);

  // Validate activeTab access ONLY when a distinct user logs in or switches accounts
  useEffect(() => {
    const currentUserId = currentUser?.id || null;
    if (currentUserId && currentUserId !== lastAuthenticatedUserIdRef.current) {
      lastAuthenticatedUserIdRef.current = currentUserId;
      // When a new user session is established, check if current tab is allowed
      if (activeTab && !canAccessTabForUser(activeTab, currentUser)) {
        const fallback = currentUser.role === 'Cashier' ? 'pos' : 'dashboard';
        handleTabChange(fallback);
      }
    } else if (!currentUserId) {
      lastAuthenticatedUserIdRef.current = null;
    }
  }, [currentUser?.id, handleTabChange]);

  const getTabStyles = (tabId: string) => {
    const isActive = activeTab === tabId;
    if (!isActive) {
      return 'text-gray-650 dark:text-slate-300 hover:bg-gray-100/80 dark:hover:bg-slate-800/80 hover:text-gray-950 dark:hover:text-white transition-all duration-150';
    }
    switch (tabId) {
      case 'voice-assistance':
        return 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20 font-bold';
      case 'online-orders':
        return 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/20 font-bold';
      case 'dashboard':
        return 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 font-bold';
      case 'pos':
        return 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 font-bold';
      case 'sales-history':
        return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 font-bold';
      case 'inventory':
        return 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 font-bold';
      case 'categories':
        return 'bg-gradient-to-r from-teal-600 to-emerald-700 text-white shadow-md shadow-teal-500/20 font-bold';
      case 'bincards':
        return 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md shadow-cyan-500/20 font-bold';
      case 'transfers':
        return 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/20 font-bold';
      case 'purchases':
        return 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-500/20 font-bold';
      case 'credit-ledger':
        return 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-500/20 font-bold';
      case 'expenses':
        return 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md shadow-red-500/20 font-bold';
      case 'customers':
        return 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md shadow-sky-500/20 font-bold';
      case 'finances':
        return 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md shadow-amber-500/20 font-bold';
      case 'teleconsultation':
        return 'bg-gradient-to-r from-purple-600 to-violet-700 text-white shadow-md shadow-purple-500/20 font-bold';
      case 'admin':
        return 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md shadow-slate-500/20 font-bold';
      case 'backup':
        return 'bg-gradient-to-r from-zinc-700 to-slate-700 text-white shadow-md shadow-zinc-500/20 font-bold';
      case 'docs':
        return 'bg-gradient-to-r from-emerald-700 to-teal-800 text-white shadow-md shadow-emerald-500/20 font-bold';
      default:
        return 'bg-emerald-600 text-white shadow-md font-bold';
    }
  };

  const refreshPharmacyNotes = async () => {
    try {
      const user = currentUserRef.current;
      const headers: Record<string, string> = {};
      if (user) {
        headers['X-User-Role'] = user.role;
        headers['X-User-Id'] = user.id;
      }
      const res = await fetch('/api/pharmacy-notes', { headers });
      if (res.ok) {
        setPharmacyNotes(await res.json());
      }
    } catch (err) {
      console.error('Failed to sync pharmacy notes:', err);
    }
  };

  const safeLocalStorageSet = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('[Storage Check] Quota exceeded. Cleaning up offline caches to free up space...');
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.includes('offline_cache_') && !k.includes('all-data')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log(`[Storage Check] Removed ${keysToRemove.length} secondary cache keys.`);

        try {
          localStorage.setItem(key, value);
          return;
        } catch (retryErr) {
          console.warn('[Storage Check] Quota still exceeded. Removing main all-data offline cache...');
          // Find any offline_cache_ key including the all-data one
          const keysToRemove2: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes('offline_cache_')) {
              keysToRemove2.push(k);
            }
          }
          keysToRemove2.forEach(k => localStorage.removeItem(k));

          try {
            localStorage.setItem(key, value);
            return;
          } catch (finalErr) {
            console.error('[Storage Check] Critical: Storage still full. Attempting emergency cleanup of other non-essential keys...');
            const keysToKeep = ['sonan_current_user', 'sonan_active_tab', 'sonan-pharmacy-theme', 'sonan-pharmacy-fontsize', 'sonan_device_id'];
            const allKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && !keysToKeep.includes(k) && k !== key) {
                allKeys.push(k);
              }
            }
            allKeys.forEach(k => localStorage.removeItem(k));
            
            try {
              localStorage.setItem(key, value);
            } catch (lastErr) {
              console.warn('[Storage Check] Swallowed storage exception: Failed to save key even after emergency cleanup:', lastErr);
            }
          }
        }
      } else {
        console.warn('[Storage Check] Non-quota error swallowed while accessing local storage:', e);
      }
    }
  };

  /**
   * Cross-Branch Consistency & Integrity Validation Layer
   * 
   * Validates and normalizes multi-branch relational data to prevent cross-branch leaks,
   * orphaned records, corrupted totals, or conflicting reporting identifiers during rapid
   * state transitions, branch switching, or high-frequency async polling.
   */
  const validateCrossBranchConsistency = (raw: any, fallbackBranches: Branch[] = []): any => {
    if (!raw || typeof raw !== 'object') return raw;

    // 1. Establish Canonical Branch Registry
    const rawBranches: Branch[] = Array.isArray(raw.branches) && raw.branches.length > 0
      ? raw.branches
      : fallbackBranches;

    const validBranches: Branch[] = rawBranches
      .filter((b): b is Branch => Boolean(b && typeof b === 'object' && b.id))
      .map(b => ({
        id: String(b.id).trim(),
        name: String(b.name || b.id).trim(),
        code: String(b.code || '').trim(),
        address: String(b.address || '').trim(),
        phone: String(b.phone || '').trim()
      }));

    const primaryBranch = validBranches.length > 0 
      ? validBranches[0] 
      : { id: 'b1', name: 'Main Branch', code: 'HQ', address: '', phone: '' };

    // Fast lookup by ID, Name, and Code (case-insensitive)
    const branchLookup = new Map<string, Branch>();
    validBranches.forEach(b => {
      if (b.id) branchLookup.set(b.id.toLowerCase(), b);
      if (b.name) branchLookup.set(b.name.toLowerCase(), b);
      if (b.code) branchLookup.set(b.code.toLowerCase(), b);
    });

    const resolveBranchRef = (inputBranchId?: string | null, inputBranchName?: string | null): { branchId: string; branchName: string } => {
      const idKey = inputBranchId ? String(inputBranchId).trim().toLowerCase() : '';
      const nameKey = inputBranchName ? String(inputBranchName).trim().toLowerCase() : '';

      if (idKey && branchLookup.has(idKey)) {
        const match = branchLookup.get(idKey)!;
        return { branchId: match.id, branchName: match.name };
      }
      if (nameKey && branchLookup.has(nameKey)) {
        const match = branchLookup.get(nameKey)!;
        return { branchId: match.id, branchName: match.name };
      }
      // Fallback to primary branch to guarantee non-leaking canonical isolation
      return { branchId: primaryBranch.id, branchName: primaryBranch.name };
    };

    // 2. Validate & Sanitize Sales (Prevent cross-branch report skewing & arithmetic corruptions)
    let sanitizedSales = raw.sales;
    if (Array.isArray(raw.sales)) {
      sanitizedSales = raw.sales
        .filter((s: any) => s && typeof s === 'object' && (s.id || s.invoiceNumber))
        .map((s: any) => {
          const { branchId, branchName } = resolveBranchRef(s.branchId, s.branchName);
          const subtotal = typeof s.subtotal === 'number' && !isNaN(s.subtotal) ? s.subtotal : 0;
          const discount = typeof s.discount === 'number' && !isNaN(s.discount) ? s.discount : 0;
          const vat = typeof s.vat === 'number' && !isNaN(s.vat) ? s.vat : 0;
          const total = typeof s.total === 'number' && !isNaN(s.total) ? s.total : Math.max(0, subtotal - discount + vat);
          
          const items = Array.isArray(s.items) 
            ? s.items.map((it: any) => ({
                ...it,
                quantity: typeof it?.quantity === 'number' && !isNaN(it.quantity) ? it.quantity : 1,
                unitPrice: typeof it?.unitPrice === 'number' && !isNaN(it.unitPrice) ? it.unitPrice : 0,
                discount: typeof it?.discount === 'number' && !isNaN(it.discount) ? it.discount : 0,
                vatAmount: typeof it?.vatAmount === 'number' && !isNaN(it.vatAmount) ? it.vatAmount : 0,
                total: typeof it?.total === 'number' && !isNaN(it.total) ? it.total : 0,
              }))
            : [];

          return {
            ...s,
            branchId,
            branchName,
            subtotal,
            discount,
            vat,
            total,
            items
          };
        });
    }

    // 3. Validate & Sanitize Stock Items (Ensure strict branch partitioning)
    let sanitizedStock = raw.stockItems;
    if (Array.isArray(raw.stockItems)) {
      sanitizedStock = raw.stockItems
        .filter((st: any) => st && typeof st === 'object' && st.medicineId)
        .map((st: any) => {
          const { branchId } = resolveBranchRef(st.branchId, st.branchName);
          return {
            ...st,
            branchId,
            quantity: typeof st.quantity === 'number' && !isNaN(st.quantity) ? st.quantity : 0,
            buyingPrice: typeof st.buyingPrice === 'number' && !isNaN(st.buyingPrice) ? st.buyingPrice : 0,
            storeQuantity: typeof st.storeQuantity === 'number' && !isNaN(st.storeQuantity) ? st.storeQuantity : (st.storeQuantity || 0),
            dispensaryQuantity: typeof st.dispensaryQuantity === 'number' && !isNaN(st.dispensaryQuantity) ? st.dispensaryQuantity : (st.dispensaryQuantity || 0)
          };
        });
    }

    // 4. Validate & Sanitize Expenses
    let sanitizedExpenses = raw.expenses;
    if (Array.isArray(raw.expenses)) {
      sanitizedExpenses = raw.expenses
        .filter((e: any) => e && typeof e === 'object' && e.id)
        .map((e: any) => {
          const { branchId, branchName } = resolveBranchRef(e.branchId, e.branchName);
          return {
            ...e,
            branchId,
            branchName,
            amount: typeof e.amount === 'number' && !isNaN(e.amount) ? e.amount : 0
          };
        });
    }

    // 5. Validate & Sanitize Purchase Orders
    let sanitizedPOs = raw.purchaseOrders;
    if (Array.isArray(raw.purchaseOrders)) {
      sanitizedPOs = raw.purchaseOrders
        .filter((po: any) => po && typeof po === 'object' && po.id)
        .map((po: any) => {
          const { branchId, branchName } = resolveBranchRef(po.branchId, po.branchName);
          return {
            ...po,
            branchId,
            branchName,
            total: typeof po.total === 'number' && !isNaN(po.total) ? po.total : 0,
            items: Array.isArray(po.items) ? po.items : []
          };
        });
    }

    // 6. Validate & Sanitize Inter-Branch Transfers
    let sanitizedTransfers = raw.transfers;
    if (Array.isArray(raw.transfers)) {
      sanitizedTransfers = raw.transfers
        .filter((tr: any) => tr && typeof tr === 'object' && tr.id)
        .map((tr: any) => {
          const fromResolved = resolveBranchRef(tr.fromBranchId, tr.fromBranchName);
          const toResolved = resolveBranchRef(tr.toBranchId, tr.toBranchName);
          return {
            ...tr,
            fromBranchId: fromResolved.branchId,
            fromBranchName: fromResolved.branchName,
            toBranchId: toResolved.branchId,
            toBranchName: toResolved.branchName,
            items: Array.isArray(tr.items) ? tr.items : []
          };
        });
    }

    // 7. Validate & Sanitize Users
    let sanitizedUsers = raw.users;
    if (Array.isArray(raw.users)) {
      sanitizedUsers = raw.users
        .filter((u: any) => u && typeof u === 'object' && u.id)
        .map((u: any) => {
          if (u.branchId && u.branchId !== 'all') {
            const { branchId } = resolveBranchRef(u.branchId);
            return { ...u, branchId };
          }
          return u;
        });
    }

    // 8. Validate & Sanitize Audit Logs
    let sanitizedAuditLogs = raw.auditLogs;
    if (Array.isArray(raw.auditLogs)) {
      sanitizedAuditLogs = raw.auditLogs
        .filter((l: any) => l && typeof l === 'object' && l.id)
        .map((l: any) => {
          if (l.branchId && l.branchId !== 'all') {
            const { branchId, branchName } = resolveBranchRef(l.branchId, l.branchName);
            return { ...l, branchId, branchName };
          }
          return l;
        });
    }

    // 9. Validate & Sanitize Pharmacy Notes
    let sanitizedNotes = raw.pharmacyNotes;
    if (Array.isArray(raw.pharmacyNotes)) {
      sanitizedNotes = raw.pharmacyNotes
        .filter((n: any) => n && typeof n === 'object' && n.id)
        .map((n: any) => {
          if (n.branchId && n.branchId !== 'all') {
            const { branchId } = resolveBranchRef(n.branchId);
            return { ...n, branchId };
          }
          return n;
        });
    }

    return {
      ...raw,
      branches: validBranches.length > 0 ? validBranches : raw.branches,
      sales: sanitizedSales,
      stockItems: sanitizedStock,
      expenses: sanitizedExpenses,
      purchaseOrders: sanitizedPOs,
      transfers: sanitizedTransfers,
      users: sanitizedUsers,
      auditLogs: sanitizedAuditLogs,
      pharmacyNotes: sanitizedNotes
    };
  };

  // Helper utility to fallback to the last known database state from localStorage if backend is offline
  const loadLocalStateFallback = (onlyIfEmpty = false) => {
    try {
      const clientDbStr = localStorage.getItem('sonan_client_db_state');
      if (clientDbStr) {
        const parsed = JSON.parse(clientDbStr);
        const data = validateCrossBranchConsistency(parsed, branches);
        if (data.branches && (!onlyIfEmpty || branches.length === 0)) setBranches(data.branches);
        if (data.users && (!onlyIfEmpty || users.length === 0)) setUsers(data.users);
        if (data.medicines && (!onlyIfEmpty || medicines.length === 0)) setMedicines(data.medicines);
        if (data.stockItems && (!onlyIfEmpty || stockItems.length === 0)) setStockItems(data.stockItems);
        if (data.suppliers && (!onlyIfEmpty || suppliers.length === 0)) setSuppliers(data.suppliers);
        if (data.purchaseOrders && (!onlyIfEmpty || purchaseOrders.length === 0)) setPurchaseOrders(data.purchaseOrders);
        if (data.transfers && (!onlyIfEmpty || transfers.length === 0)) setTransfers(data.transfers);
        if (data.customers && (!onlyIfEmpty || customers.length === 0)) setCustomers(data.customers);
        if (data.expenses && (!onlyIfEmpty || expenses.length === 0)) setExpenses(data.expenses);
        if (data.sales && (!onlyIfEmpty || sales.length === 0)) setSales(data.sales);
        if (data.categories && (!onlyIfEmpty || categories.length === 0)) setCategories(data.categories);
        if (data.auditLogs && (!onlyIfEmpty || auditLogs.length === 0)) setAuditLogs(data.auditLogs);
        if (data.pharmacyNotes && (!onlyIfEmpty || pharmacyNotes.length === 0)) setPharmacyNotes(data.pharmacyNotes);
        console.log('[Offline Support] Loaded validated database state from local cache.');
      }
    } catch (e) {
      console.error('[Offline Support] Failed to load local state fallback:', e);
    }
  };

  // Helper for silent background updates without triggering full-page busy/spinner state
  const handleSilentSync = () => refreshAllCollections(2, 1000, true);

  // Synchronously hydrate all collections into React state with strict cross-branch validation
  const applyAllData = (rawPayload: any) => {
    if (!rawPayload) return;

    // Validate data consistency across branches to prevent report mixing during rapid state transitions
    const data = validateCrossBranchConsistency(rawPayload, branches);

    if (data.branches) setBranches(data.branches);
    if (data.users) {
      setUsers(data.users);
      // Synchronize current tab's active user profile with fresh data from server only if values actually changed
      const activeUser = currentUserRef.current;
      if (activeUser && activeUser.id) {
        const freshUser = data.users.find((u: any) => u.id === activeUser.id || (u.username && activeUser.username && u.username.toLowerCase() === activeUser.username.toLowerCase()));
        if (freshUser) {
          setCurrentUser(prev => {
            if (!prev || prev.id !== freshUser.id) return prev;
            if (
              prev.role !== freshUser.role ||
              prev.branchId !== freshUser.branchId ||
              prev.name !== freshUser.name ||
              JSON.stringify(prev.permissions || []) !== JSON.stringify(freshUser.permissions || [])
            ) {
              return { ...prev, ...freshUser };
            }
            return prev;
          });
          try {
            sessionStorage.setItem('sonan_current_user', JSON.stringify(freshUser));
          } catch {}
        }
      }
    }
    if (data.medicines) setMedicines(data.medicines);
    if (data.stockItems) setStockItems(data.stockItems);
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.purchaseOrders) setPurchaseOrders(data.purchaseOrders);
    if (data.transfers) setTransfers(data.transfers);
    if (data.customers) setCustomers(data.customers);
    if (data.expenses) setExpenses(data.expenses);
    if (data.sales) setSales(data.sales);
    if (data.categories) setCategories(data.categories);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
    if (data.pharmacyNotes) setPharmacyNotes(data.pharmacyNotes);
    setIsBackendConnected(true);
    setLoadingDb(false);
  };

  const isFetchingAllDataRef = React.useRef<boolean>(false);
  const lastAllDataFetchTimeRef = React.useRef<number>(0);

  // 1. Core State Sync Engine (With Concurrency Control & Robust Retry Backoff)
  const refreshAllCollections = async (retriesArg?: any, delay = 1000, silent = true) => {
    // Prevent overlapping parallel fetches of the bulk payload
    if (isFetchingAllDataRef.current) return;
    isFetchingAllDataRef.current = true;

    const retries = typeof retriesArg === 'number' ? retriesArg : 3;
    try {
      if (!silent) {
        setLoadingDb(true);
      }
      const user = currentUserRef.current;
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };
      if (user) {
        headers['X-User-Role'] = user.role;
        headers['X-User-Id'] = user.id;
      }
      const res = await fetch('/api/all-data', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        lastAllDataFetchTimeRef.current = Date.now();

        // Asynchronously save complete fresh backup to localStorage in background idle time
        setTimeout(() => {
          try {
            if (data && data.medicines && data.medicines.length > 0) {
              safeLocalStorageSet('sonan_client_db_state', JSON.stringify(data));
            }
          } catch (e) {
            console.error('Non-critical background storage sync warning:', e);
          }
        }, 50);

        applyAllData(data);
      } else {
        if (retries > 0) {
          console.warn(`Fetch /api/all-data returned status ${res.status}. Retrying in ${delay}ms... (${retries} retries left)`);
          setTimeout(() => {
            isFetchingAllDataRef.current = false;
            refreshAllCollections(retries - 1, delay * 1.5, silent);
          }, delay);
          return;
        } else {
          // Do not erase existing active in-memory data
          loadLocalStateFallback(true);
          setIsBackendConnected(false);
          setLoadingDb(false);
        }
      }
    } catch (err) {
      console.error('Core DB sync failure:', err);
      if (retries > 0) {
        console.warn(`Fetch /api/all-data failed. Retrying in ${delay}ms... (${retries} retries left)`);
        setTimeout(() => {
          isFetchingAllDataRef.current = false;
          refreshAllCollections(retries - 1, delay * 1.5, silent);
        }, delay);
        return;
      } else {
        // Do not erase existing active in-memory data
        loadLocalStateFallback(true);
        setIsBackendConnected(false);
        setLoadingDb(false);
      }
    } finally {
      isFetchingAllDataRef.current = false;
    }
  };

  const triggerManualSync = async () => {
    if (syncInProgress) return;
    setSyncInProgress(true);
    try {
      const success = await offlineManager.syncPendingRequests();
      if (success) {
        alert('All pending transactions synchronized successfully with the central server!');
        refreshAllCollections(3, 500, false);
      } else {
        alert('Some offline transactions could not be verified. Please check network status.');
      }
    } catch (e) {
      console.error('Manual sync failure:', e);
      alert('Network is still unreachable. Re-connection and sync will occur automatically once stable.');
    } finally {
      setSyncInProgress(false);
    }
  };

  useEffect(() => {
    // Instant fallback hydration for fast UI painting while fetch is in-flight
    loadLocalStateFallback(true);
    // Immediately fetch fresh authoritative live database state from server on app launch
    refreshAllCollections(3, 500, true);

    // Revalidate on focus/visibility change with a 20-second throttle to prevent freezing
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastAllDataFetchTimeRef.current > 20000) {
        refreshAllCollections(2, 500, true);
      }
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastAllDataFetchTimeRef.current > 20000) {
          refreshAllCollections(2, 500, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Poll pharmacy notes/security alerts every 5 seconds when logged in to receive security OTPs in real-time
  useEffect(() => {
    if (currentUser) {
      refreshPharmacyNotes();
      const interval = setInterval(() => {
        refreshPharmacyNotes();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Request Desktop Notification Permission on login
  useEffect(() => {
    if (currentUser && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [currentUser]);

  // Poll for incoming teleconsultation customer requests / phone calls across admin pages
  useEffect(() => {
    if (!currentUser) return;

    const checkIncomingTeleconsultations = async () => {
      try {
        const res = await fetch('/api/teleconsultations');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            const queuedList = list.filter((s: any) => s.status === 'queued');
            setQueuedTeleCount(queuedList.length);

            // Check for brand new queued sessions
            const newestQueued = queuedList.find((s: any) => !seenTeleIdsRef.current.has(s.id));
            if (newestQueued) {
              seenTeleIdsRef.current.add(newestQueued.id);
              setIncomingTeleAlertSession(newestQueued);
              setCallRingingSeconds(0);
              setIsCallRingingMuted(false);
              playIncomingCallChime();

              // Trigger Desktop Notification
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  const notif = new Notification(`🚨 Incoming Customer Call: ${newestQueued.customerName || 'Online Customer'}`, {
                    body: `Phone: ${newestQueued.customerPhone || 'Direct'} • ${newestQueued.type === 'video' ? 'Video Call' : 'Hotline Call'} (${newestQueued.topic || 'Inquiry'})`,
                    icon: '/icon.png',
                    tag: newestQueued.id
                  });
                  notif.onclick = () => {
                    window.focus();
                    setTargetTeleSessionId(newestQueued.id);
                    setActiveTab('teleconsultation');
                  };
                } catch (e) {
                  // silent
                }
              }
            } else if (queuedList.length === 0) {
              setIncomingTeleAlertSession(null);
            }
          }
        }
      } catch (err) {
        // silent fail on network glitch
      }
    };

    checkIncomingTeleconsultations();
    const teleInterval = setInterval(checkIncomingTeleconsultations, 2500);
    return () => clearInterval(teleInterval);
  }, [currentUser]);

  // Ringing timer & audio chime repeating interval when an incoming call is waiting
  useEffect(() => {
    if (!incomingTeleAlertSession) return;

    let seconds = 0;
    const timer = setInterval(() => {
      seconds += 1;
      setCallRingingSeconds(seconds);

      // Re-chime every 4 seconds if not muted
      if (seconds % 4 === 0 && !isCallRingingMuted) {
        playIncomingCallChime();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingTeleAlertSession, isCallRingingMuted]);

  // Safely initialize active branch context on login without resetting activeTab
  const initialBranchSetRef = React.useRef<boolean>(false);
  useEffect(() => {
    if (currentUser && !initialBranchSetRef.current) {
      initialBranchSetRef.current = true;
      if (currentUser.branchId && currentUser.role !== 'Super Administrator' && currentUser.role !== 'Auditor') {
        setActiveBranchContext(currentUser.branchId);
      }
    }
  }, [currentUser?.id]);

  // 2. Authentication handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    let deviceId = localStorage.getItem('sonan_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('sonan_device_id', deviceId);
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput, deviceId })
      });

      if (res.ok) {
        const data = await res.json();
        setIsBackendConnected(true);
        if (data.requiresDeviceOtp) {
          setDeviceOtpUser(data.user);
          setDeviceOtpId(data.deviceId);
          setOtpSentTo(data.otpSentTo || null);
          setShowDeviceOtpModal(true);
        } else {
          if (data.initialData) {
            applyAllData(data.initialData);
          }
          setCurrentUser(data.user);
          try {
            sessionStorage.setItem('sonan_current_user', JSON.stringify(data.user));
            localStorage.setItem('sonan_current_user', JSON.stringify(data.user));
          } catch {}
          
          // Select starting tab on login
          const defaultTab = data.user.role === 'Cashier' ? 'pos' : 'dashboard';
          const savedTab = sessionStorage.getItem('sonan_active_tab') || localStorage.getItem('sonan_active_tab');
          if (savedTab && canAccessTabForUser(savedTab, data.user)) {
            handleTabChange(savedTab);
          } else {
            handleTabChange(defaultTab);
          }

          // Save backup asynchronously in idle time to keep UI 100% responsive
          setTimeout(() => {
            if (data.initialData) {
              safeLocalStorageSet('sonan_client_db_state', JSON.stringify(data.initialData));
            }
          }, 300);
        }
      } else {
        let errorMsg = 'Invalid credentials.';
        try {
          const err = await res.json();
          errorMsg = err.error || errorMsg;
        } catch (jsonErr) {
          errorMsg = `Server error (${res.status}): ${res.statusText || 'Unable to parse server response.'}`;
        }
        setAuthError(errorMsg);
        setIsBackendConnected(true);
      }
    } catch (err: any) {
      setAuthError(`Connection Error: Express backend is booting or offline (${err?.message || err}).`);
      setIsBackendConnected(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDeviceOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceOtpError('');

    if (!deviceOtpCode || deviceOtpCode.trim().length !== 6) {
      setDeviceOtpError('OTP must be exactly 6 digits.');
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-device-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: deviceOtpUser?.id,
          deviceId: deviceOtpId,
          code: deviceOtpCode
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.initialData) {
          applyAllData(data.initialData);
        }
        setCurrentUser(data.user);
        try {
          sessionStorage.setItem('sonan_current_user', JSON.stringify(data.user));
          localStorage.setItem('sonan_current_user', JSON.stringify(data.user));
        } catch {}
        
        // Select starting tab on login
        const defaultTab = data.user.role === 'Cashier' ? 'pos' : 'dashboard';
        const savedTab = sessionStorage.getItem('sonan_active_tab') || localStorage.getItem('sonan_active_tab');
        if (savedTab && canAccessTabForUser(savedTab, data.user)) {
          handleTabChange(savedTab);
        } else {
          handleTabChange(defaultTab);
        }

        setShowDeviceOtpModal(false);
        setDeviceOtpUser(null);
        setDeviceOtpCode('');
        setTimeout(() => {
          if (data.initialData) {
            safeLocalStorageSet('sonan_client_db_state', JSON.stringify(data.initialData));
          }
        }, 300);
      } else {
        const err = await res.json();
        setDeviceOtpError(err.error || 'Invalid OTP code.');
      }
    } catch (err) {
      setDeviceOtpError('REST timeout verifying OTP.');
    }
  };

  const handleDirectDeviceAuthorize = async () => {
    if (!deviceOtpUser || !deviceOtpId) return;
    try {
      setDeviceOtpError('');
      const res = await fetch('/api/devices/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: deviceOtpUser.id,
          deviceId: deviceOtpId,
          operatorId: deviceOtpUser.id
        })
      });

      if (res.ok) {
        // Now authenticate user normally since the device is now authorized
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput,
            password: passwordInput,
            deviceId: deviceOtpId
          })
        });

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          if (loginData.initialData) {
            applyAllData(loginData.initialData);
          }
          setCurrentUser(loginData.user);
          try {
            sessionStorage.setItem('sonan_current_user', JSON.stringify(loginData.user));
            localStorage.setItem('sonan_current_user', JSON.stringify(loginData.user));
          } catch {}
          
          // Select starting tab on login
          const defaultTab = loginData.user.role === 'Cashier' ? 'pos' : 'dashboard';
          const savedTab = sessionStorage.getItem('sonan_active_tab') || localStorage.getItem('sonan_active_tab');
          if (savedTab && canAccessTabForUser(savedTab, loginData.user)) {
            handleTabChange(savedTab);
          } else {
            handleTabChange(defaultTab);
          }

          setShowDeviceOtpModal(false);
          setDeviceOtpUser(null);
          setDeviceOtpCode('');
          setTimeout(() => {
            if (loginData.initialData) {
              safeLocalStorageSet('sonan_client_db_state', JSON.stringify(loginData.initialData));
            }
          }, 300);
        } else {
          setDeviceOtpError('Device authorized, but login authentication failed.');
        }
      } else {
        const err = await res.json();
        setDeviceOtpError(err.error || 'Failed to authorize device directly.');
      }
    } catch (err) {
      console.error(err);
      setDeviceOtpError('Network error authorizing device.');
    }
  };

  const handleLogout = () => {
    const loggingOutId = currentUserRef.current?.id;
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('sonan_current_user');
      sessionStorage.removeItem('sonan_active_tab');
      // Only clear localStorage user if it belongs to this tab's user
      const stored = localStorage.getItem('sonan_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id === loggingOutId) {
          localStorage.removeItem('sonan_current_user');
        }
      }
    } catch {}
    initialBranchSetRef.current = false;
    setUsernameInput('admin');
    setPasswordInput('admin123');
  };

  // 1-hour (60 minutes) inactivity auto-logout mechanism for multi-user pharmacy environment security
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        alert('Security Notice: You have been automatically logged out due to 1 hour (60 minutes) of inactivity.');
      }, 60 * 60 * 1000); // 1 hour (60 minutes)
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [currentUser]);

  // Handle offline sync manager updates and reload events
  useEffect(() => {
    const handleSyncUpdate = () => {
      setIsOffline(offlineManager.isOffline());
      setIsSimulated(offlineManager.isSimulated());
      setPendingSyncCount(offlineManager.getQueue().length);
    };

    const handleSyncCompleted = () => {
      refreshAllCollections();
    };

    offlineManager.addListener(handleSyncUpdate);
    window.addEventListener('offline-sync-completed', handleSyncCompleted);

    // Initial load sync checks
    handleSyncUpdate();

    return () => {
      offlineManager.removeListener(handleSyncUpdate);
      window.removeEventListener('offline-sync-completed', handleSyncCompleted);
    };
  }, []);

  // 3. Render Public Store or Login screen when unauthenticated or requested
  if (isPublicStoreMode) {
    return <PublicCustomerStore onBackToApp={() => setIsPublicStoreMode(false)} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
        
        {/* Top Public Customer Store Banner */}
        <div className="mb-4 text-center">
          <button
            onClick={() => setIsPublicStoreMode(true)}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-full shadow-lg transition transform hover:scale-105"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>🛍️ Open Customer Online Medicine & Cosmetic Store →</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-150 dark:border-slate-800 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 overflow-hidden transition-all duration-200">
          
          {/* Left panel design banner */}
          <div className="bg-emerald-900 dark:bg-emerald-950 p-10 text-white flex flex-col justify-between relative overflow-hidden transition-colors duration-200">
            {/* Ambient visual background design */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent)] pointer-events-none"></div>
            
            <div className="space-y-3 relative z-10">
              <div className="flex items-center gap-2">
                <Building className="h-7 w-7 text-emerald-300 dark:text-emerald-400" />
                <span className="font-sans font-bold text-lg uppercase tracking-wider">Advanced Pharmacy</span>
              </div>
              <p className="text-xs text-emerald-100 dark:text-emerald-200 max-w-xs font-sans leading-relaxed">
                Welcome to Advanced Pharmaceutical Stock Management System, please login to continue.
              </p>
            </div>

            <div className="space-y-4 relative z-10">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 dark:text-emerald-400 font-bold">
                Relational Safe Guards Engaged
              </span>
              <div className="space-y-2 text-xs text-emerald-50 dark:text-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 dark:bg-emerald-400"></span>
                  Zero-loss backup restore rollback engine
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 dark:bg-emerald-400"></span>
                  EAN-13 Duplicate prevention
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 dark:bg-emerald-400"></span>
                  Role-Based multi-branch access control
                </div>
              </div>
            </div>

            <div className="text-[10px] text-emerald-250 font-mono relative z-10">
              © 2026 Advanced Pharmacy Co. Ltd.
            </div>
          </div>

          {/* Right panel login form */}
          <div className="p-10 flex flex-col justify-center space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-sans font-bold text-gray-950 dark:text-white tracking-tight">System Login</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Welcome to Advanced Pharmaceutical Stock Management System, please login to continue.</p>
              </div>
              
              {/* Live Backend Connection Indicator */}
              <div className="shrink-0">
                {isBackendConnected === null ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                    Syncing...
                  </span>
                ) : isBackendConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Connected
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => refreshAllCollections()}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-all cursor-pointer"
                    title="Click to retry connecting"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    Offline (Retry)
                  </button>
                )}
              </div>
            </div>

            {authError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-400 text-xs p-3 rounded-lg flex items-center gap-2 font-sans font-semibold transition-colors">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-slate-300 block">Username ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg p-2.5 pl-10 outline-none text-gray-800 dark:text-slate-250 focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
                    placeholder="Enter username ID"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-700 dark:text-slate-300 block">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg p-2.5 pl-10 outline-none text-gray-800 dark:text-slate-250 focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
                    placeholder="Enter password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? 'Verifying secure socket...' : 'Establish Secure Connection'}
              </button>
            </form>

            {/* Quick Demo Predefined Accounts Picker */}
            <div className="border-t border-gray-150 dark:border-slate-800 pt-5 space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold text-gray-400 dark:text-gray-550 tracking-wider block">
                Enterprise Test Accounts (Pre-Seeded)
              </span>
              <div className="grid grid-cols-1 gap-2 text-[10px] font-sans">
                <button
                  type="button"
                  onClick={() => { setUsernameInput('admin'); setPasswordInput('admin123'); }}
                  className="bg-gray-55 dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 text-left p-2.5 rounded-lg transition-all duration-150 cursor-pointer text-gray-750 dark:text-slate-300"
                >
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-xs">Default Super Administrator</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">Username: <b className="font-mono text-gray-800 dark:text-white">admin</b> | Password: <b className="font-mono text-gray-800 dark:text-white">admin123</b></span>
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Secure Device Recognition OTP authorization modal */}
        {showDeviceOtpModal && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-150 dark:border-slate-800 max-w-sm w-full p-6 text-xs text-gray-800 dark:text-slate-200 font-sans space-y-4 transition-all duration-200">
              <div className="text-center space-y-1">
                <div className="bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 p-2.5 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2 border border-amber-200 dark:border-amber-900/55">
                  <Shield className="h-6 w-6 text-amber-500 animate-pulse" />
                </div>
                <h3 className="text-sm font-sans font-extrabold text-gray-950 dark:text-white">
                  {deviceOtpUser?.twoFactorEnabled ? 'Two-Factor Authentication' : 'New Device Detected'}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-xs leading-normal mx-auto">
                  {deviceOtpUser?.twoFactorEnabled 
                    ? 'A 6-digit Two-Factor (2FA) verification code has been dispatched to your contact coordinates.' 
                    : 'For secure multi-device enterprise auditing, a 6-digit Device Authorization Code has been generated.'
                  }
                </p>

                {otpSentTo && (
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[11px] text-emerald-800 dark:text-emerald-400 p-2.5 rounded-lg text-left space-y-1 mt-2">
                    <div className="font-bold flex items-center gap-1 text-emerald-900 dark:text-emerald-300">
                      <span>✓ Dispatched OTP Reports:</span>
                    </div>
                    <div className="grid grid-cols-1 gap-0.5 font-mono text-[10px]">
                      <div>📧 Email: <span className="font-semibold">{otpSentTo.email}</span></div>
                      <div>📞 Phone: <span className="font-semibold">{otpSentTo.phone}</span></div>
                    </div>
                    <p className="text-[9px] text-emerald-600/90 dark:text-emerald-500/90 mt-1 italic">
                      Check your inbox. Code is also logged in terminal & "System Alerts" console!
                    </p>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg mt-2 font-mono">
                  Device ID: {deviceOtpId}
                </div>
              </div>

              {deviceOtpError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-400 p-2.5 rounded-lg text-center font-semibold">
                  {deviceOtpError}
                </div>
              )}

              <form onSubmit={handleDeviceOtpVerify} className="space-y-3">
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="------"
                  value={deviceOtpCode}
                  onChange={(e) => setDeviceOtpCode(e.target.value)}
                  className="w-full text-center tracking-widest text-lg font-bold font-mono bg-gray-55 dark:bg-slate-950 border border-gray-200 dark:border-slate-850 p-2.5 rounded-lg outline-none text-gray-900 dark:text-white"
                />

                {/* Reveal OTP in Security Alert Button */}
                <button
                  type="button"
                  onClick={async () => {
                    if (!showRevealedOtpInModal) {
                      try {
                        const res = await fetch(`/api/auth/pending-otp?userId=${deviceOtpUser?.id || ''}`);
                        const data = await res.json();
                        if (data.code) {
                          setFetchedPendingOtp(data.code);
                          setDeviceOtpCode(data.code);
                        } else {
                          const noteOtp = pharmacyNotes.find(n => n.text?.includes('Code:'))?.text?.match(/Code:\s*(\d{6})/)?.[1];
                          if (noteOtp) {
                            setFetchedPendingOtp(noteOtp);
                            setDeviceOtpCode(noteOtp);
                          } else {
                            setFetchedPendingOtp('123456');
                            setDeviceOtpCode('123456');
                          }
                        }
                      } catch(e) {
                        setFetchedPendingOtp('123456');
                        setDeviceOtpCode('123456');
                      }
                    }
                    setShowRevealedOtpInModal(!showRevealedOtpInModal);
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm text-[11px] cursor-pointer transition-all"
                >
                  {showRevealedOtpInModal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{showRevealedOtpInModal ? '🔒 Hide Security Alert OTP' : '👁️ See OTP in Security Alert'}</span>
                </button>

                {showRevealedOtpInModal && (
                  <div className="bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 p-2.5 rounded-lg text-center space-y-1 animate-fade-in">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                      <Key className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                      <span>Unlocked Security Alert OTP Code</span>
                    </div>
                    <div className="font-mono text-xl font-black text-amber-950 dark:text-amber-100 tracking-widest bg-white/80 dark:bg-slate-900 py-1.5 px-3 rounded border border-amber-200 dark:border-amber-900">
                      {fetchedPendingOtp || '123456'}
                    </div>
                    <p className="text-[9px] text-amber-800 dark:text-amber-400 font-semibold">
                      ✓ OTP Auto-filled into input box. Click verify button below to complete login.
                    </p>
                  </div>
                )}
                
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-emerald-500/10 cursor-pointer transition-all duration-150"
                >
                  {deviceOtpUser?.twoFactorEnabled ? 'Verify Security OTP & Login' : 'Authorize New Device & Login'}
                </button>

                {deviceOtpUser && (deviceOtpUser.role === UserRole.SUPER_ADMIN || deviceOtpUser.username === 'admin') && (
                  <>
                    <button
                      type="button"
                      onClick={handleDirectDeviceAuthorize}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold py-2.5 px-4 rounded-lg shadow-md cursor-pointer transition-all duration-150 text-center"
                    >
                      ⚡ Direct Authorize &amp; Bypass OTP
                    </button>

                    <div className="text-center bg-gray-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-150 dark:border-slate-850 text-[10px] text-gray-500 dark:text-gray-450 leading-relaxed">
                      Tip: Contact the Administrator. If you are on the administrator account, check the <b>Pharmacy Notes / Announcements log</b> or server terminal for code: <b className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">123456</b> (pre-authorized bypass code).
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Derived variable for filtered statistics context
  const targetSales = sales.filter(s => {
    if (!activeBranchContext || activeBranchContext === 'all') return true;
    if (s.branchId && String(s.branchId).trim() === String(activeBranchContext).trim()) return true;

    const targetB = branches.find(b => 
      String(b.id).trim() === String(activeBranchContext).trim() || 
      String(b.name).trim().toLowerCase() === String(activeBranchContext).trim().toLowerCase() ||
      (b.code && String(b.code).trim().toLowerCase() === String(activeBranchContext).trim().toLowerCase())
    );

    if (targetB) {
      const sId = s.branchId ? String(s.branchId).trim() : '';
      if (sId && (
        sId === String(targetB.id).trim() ||
        (targetB.code && sId.toLowerCase() === String(targetB.code).trim().toLowerCase()) ||
        sId.toLowerCase() === String(targetB.name).trim().toLowerCase()
      )) return true;

      if (s.branchName) {
        const sNameLower = String(s.branchName).trim().toLowerCase();
        const bNameLower = String(targetB.name).trim().toLowerCase();
        const bCodeLower = targetB.code ? String(targetB.code).trim().toLowerCase() : '';
        if (sNameLower === bNameLower || (bCodeLower && sNameLower === bCodeLower)) return true;
      }
    }

    if (s.branchName) {
      const sNameLower = String(s.branchName).trim().toLowerCase();
      const ctxLower = String(activeBranchContext).trim().toLowerCase();
      if (sNameLower === ctxLower) return true;
    }

    return false;
  });

  const targetInventory = stockItems.filter(st => {
    if (!activeBranchContext || activeBranchContext === 'all') return true;
    if (st.branchId && String(st.branchId).trim() === String(activeBranchContext).trim()) return true;

    const targetB = branches.find(b => 
      String(b.id).trim() === String(activeBranchContext).trim() || 
      String(b.name).trim().toLowerCase() === String(activeBranchContext).trim().toLowerCase() ||
      (b.code && String(b.code).trim().toLowerCase() === String(activeBranchContext).trim().toLowerCase())
    );

    if (targetB) {
      const stId = st.branchId ? String(st.branchId).trim() : '';
      if (stId && (
        stId === String(targetB.id).trim() ||
        (targetB.code && stId.toLowerCase() === String(targetB.code).trim().toLowerCase()) ||
        stId.toLowerCase() === String(targetB.name).trim().toLowerCase()
      )) return true;
    }

    return false;
  });

  const activeBranchName = activeBranchContext === 'all' ? 'All Active Nodes' : branches.find(b => b.id === activeBranchContext)?.name || 'Local node';
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col font-sans text-gray-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Dynamic Font Scaler style tag */}
      <style>{`
        html {
          font-size: ${fontSize === 'sm' ? '12px' : fontSize === 'lg' ? '15px' : fontSize === 'xl' ? '17px' : '14px'} !important;
        }
      `}</style>

      {/* Non-intrusive Floating Popping Call Notification Toast (Top-Right, Unobtrusive, with Silence and Decline options) */}
      {incomingTeleAlertSession && (
        <div className="fixed top-4 right-4 z-50 max-w-sm sm:max-w-md w-full animate-fade-in shadow-2xl rounded-2xl border-2 border-emerald-500 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 text-slate-800 dark:text-slate-100 transition-all duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                <div className={`absolute -inset-1 bg-emerald-500 rounded-full ${isCallRingingMuted ? 'opacity-20' : 'animate-ping opacity-75'}`}></div>
                <div className="relative p-2.5 bg-emerald-600 text-white rounded-xl shadow-md flex items-center justify-center">
                  <PhoneIncoming className={`w-5 h-5 ${isCallRingingMuted ? '' : 'animate-bounce'}`} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full bg-white ${isCallRingingMuted ? '' : 'animate-ping'}`}></span>
                    Incoming Call
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                    {incomingTeleAlertSession.type === 'video' ? '📹 Video' : '📞 Live Hotline'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    ⏳ {callRingingSeconds}s
                  </span>
                  {isCallRingingMuted && (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                      <VolumeX className="w-3 h-3" /> Silenced
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {incomingTeleAlertSession.customerName || 'Online Customer'}
                  </h4>
                  {incomingTeleAlertSession.customerPhone && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        📞 {incomingTeleAlertSession.customerPhone}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(incomingTeleAlertSession.customerPhone);
                          setCopiedCallerPhone(true);
                          setTimeout(() => setCopiedCallerPhone(false), 2000);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                        title="Copy Phone Number"
                      >
                        {copiedCallerPhone ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                  {incomingTeleAlertSession.topic && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                      "{incomingTeleAlertSession.topic}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick close / dismiss button */}
            <button
              type="button"
              onClick={() => {
                setIncomingTeleAlertSession(null);
                setIsCallRingingMuted(true);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Button Bar with Silence, Decline, and Answer */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
            {/* Answer & Connect */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch(`/api/teleconsultations/${incomingTeleAlertSession.id}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      status: 'active',
                      pharmacistId: currentUser?.id || 'u_pharm',
                      pharmacistName: currentUser?.name || 'On-Duty Pharmacist'
                    })
                  }).catch(() => {});
                } catch (e) {}

                setTargetTeleSessionId(incomingTeleAlertSession.id);
                setActiveTab('teleconsultation');
                setIncomingTeleAlertSession(null);
                setIsCallRingingMuted(true);
              }}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-white" />
              <span>Answer</span>
            </button>

            {/* Silence Ringtone */}
            <button
              type="button"
              onClick={() => setIsCallRingingMuted(!isCallRingingMuted)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                isCallRingingMuted 
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700' 
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title={isCallRingingMuted ? 'Unmute Ringtone' : 'Silence Ringtone'}
            >
              {isCallRingingMuted ? <Volume2 className="w-3.5 h-3.5 text-amber-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />}
              <span>{isCallRingingMuted ? 'Unmute' : 'Silence'}</span>
            </button>

            {/* Decline Call */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch(`/api/teleconsultations/${incomingTeleAlertSession.id}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      status: 'declined',
                      pharmacistId: currentUser?.id || 'u_pharm',
                      pharmacistName: currentUser?.name || 'On-Duty Pharmacist'
                    })
                  }).catch(() => {});
                } catch (e) {}

                setIncomingTeleAlertSession(null);
                setIsCallRingingMuted(true);
              }}
              className="py-2 px-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              title="Decline and dismiss call"
            >
              <PhoneOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Sync Status Header banner */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-150 dark:border-slate-800 sticky top-0 z-30 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-sm transition-colors duration-200">
        
        {/* Logo and Context info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile menu toggle button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 cursor-pointer hover:bg-gray-200 transition-all shrink-0"
            title="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="bg-emerald-700 text-white p-1.5 sm:p-2 rounded-lg shrink-0">
            <Building className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-800 dark:text-emerald-400 uppercase block tracking-wider truncate">Advanced Pharmacy</span>
            <span className="text-xs sm:text-sm font-sans font-black text-gray-950 dark:text-white block truncate">Enterprise Suite</span>
          </div>

          <div className="h-6 w-[1.5px] bg-gray-200 dark:bg-slate-800 hidden md:block"></div>

          {/* Super admin global node filter selector (Desktop) */}
          {(currentUser.role === 'Super Administrator' || currentUser.role === 'Auditor' || currentUser.role === 'Accountant') ? (
            <div className="hidden md:flex items-center gap-1.5 bg-gray-55 dark:bg-slate-950 px-2.5 py-1.5 rounded border border-gray-150 dark:border-slate-850 transition-colors duration-200">
              <span className="text-[10px] text-gray-450 dark:text-gray-500 uppercase font-bold font-mono">Context:</span>
              <select
                value={activeBranchContext}
                onChange={(e) => setActiveBranchContext(e.target.value)}
                className="text-xs font-semibold bg-transparent text-gray-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Enterprise Nodes (All)</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="hidden md:flex text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 px-2.5 py-1.5 rounded border border-gray-200 dark:border-slate-700 items-center gap-1 transition-colors duration-200">
              <MapPin className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
              {activeBranchName} Node
            </div>
          )}
        </div>

        {/* User context information & Theme switcher & Trigger Sync & logout */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Font Size Adjuster Control (Desktop) */}
          <div className="hidden lg:flex items-center gap-1 bg-gray-55 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-gray-150 dark:border-slate-700 text-xs">
            <span className="font-bold text-gray-500 dark:text-gray-400">A</span>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as any)}
              className="bg-transparent font-semibold text-gray-800 dark:text-slate-200 outline-none cursor-pointer text-xs"
              title="Adjust Font Size"
            >
              <option value="sm">Font: Sm</option>
              <option value="base">Font: Normal</option>
              <option value="lg">Font: Lg</option>
              <option value="xl">Font: XL</option>
            </select>
          </div>

          {/* Late-night Shift Theme Switcher Button */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? "Switch to dark mode (Late-night pharmacy shift)" : "Switch to light mode"}
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-gray-55 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white border border-gray-150 dark:border-slate-700 transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-sm text-xs"
          >
            {theme === 'light' ? (
              <>
                <Moon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-gray-600 hidden sm:inline">Late Shift</span>
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-slate-200 hidden sm:inline">Day Shift</span>
              </>
            )}
          </button>

          {/* Desktop Offline/Online Sync Control Deck */}
          <div className="hidden sm:flex items-center gap-2 border border-gray-150 dark:border-slate-700 bg-gray-55 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
            {isOffline ? (
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold" title="Offline mode active. Operations are secured in a local browser sync queue.">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-ping"></span>
                <span>Offline</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold" title="Connected to central pharmacy server.">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>Online</span>
              </span>
            )}

            <button
              onClick={() => offlineManager.toggleSimulation()}
              title={isSimulated ? "Resume automatic online server checks" : "Simulate offline mode to test local transaction queueing"}
              className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border uppercase transition-all cursor-pointer ${
                isSimulated 
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 dark:border-slate-650'
              }`}
            >
              {isSimulated ? "🔌 Restore Network" : "📡 Work Offline"}
            </button>

            {pendingSyncCount > 0 && (
              <button
                onClick={triggerManualSync}
                disabled={syncInProgress}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all animate-pulse"
                title={`${pendingSyncCount} operations queued. Click to synchronize immediately.`}
              >
                {syncInProgress ? (
                  <span>Syncing...</span>
                ) : (
                  <span>🔄 Sync {pendingSyncCount}</span>
                )}
              </button>
            )}
          </div>

          {/* Mobile Offline Indicator Dot */}
          <div className="flex sm:hidden items-center">
            <span
              className={`h-2.5 w-2.5 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-500'}`}
              title={isOffline ? 'Offline Mode' : 'Online Mode'}
            />
            {pendingSyncCount > 0 && (
              <button
                onClick={triggerManualSync}
                className="ml-1 px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-extrabold rounded-md animate-pulse"
              >
                {pendingSyncCount}
              </button>
            )}
          </div>

          {canAccessTab('teleconsultation') && queuedTeleCount > 0 && (
            <button
              type="button"
              onClick={() => {
                if (incomingTeleAlertSession) {
                  setTargetTeleSessionId(incomingTeleAlertSession.id);
                }
                setActiveTab('teleconsultation');
              }}
              title={`${queuedTeleCount} customer(s) requesting teleconsultation`}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-black transition cursor-pointer shadow-sm"
            >
              <PhoneIncoming className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Call</span>
              <span>({queuedTeleCount})</span>
            </button>
          )}

          {canAccessTab('online-orders') && (
            <button
              type="button"
              onClick={handleOpenAppShareModal}
              title="Share Customer Online Store Link & QR Code"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share Store</span>
            </button>
          )}

          <button
            onClick={refreshAllCollections}
            disabled={loadingDb}
            title="Refresh database records"
            className="hidden sm:block p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loadingDb ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
          </button>

          <div className="hidden md:block text-right leading-none space-y-1">
            <span className="text-xs font-bold text-gray-900 dark:text-white block">{currentUser.name}</span>
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 uppercase bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/50 inline-block transition-colors duration-200">
              {currentUser.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out of system"
            className="bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 p-1.5 sm:p-2.5 rounded border border-red-100 dark:border-red-900/40 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

      </header>

      {/* Main Grid: Sidebar vs Active Panel Workspace */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Dynamic Nav Sidebar matching RBAC access levels (Desktop) */}
        <aside className="hidden md:block w-64 bg-white dark:bg-slate-900 border-r border-gray-150 dark:border-slate-800 p-4 space-y-5 shrink-0 transition-colors duration-200">
          
          {/* Quick Launchpad Maximize Action */}
          <div className="px-1 pb-1">
            <button
              type="button"
              onClick={() => setShowAllMaximize(true)}
              className="w-full text-left p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-100/50 hover:from-indigo-100 hover:to-indigo-200/50 dark:from-slate-850 dark:to-slate-800 dark:hover:from-slate-800 dark:hover:to-slate-750 text-indigo-950 dark:text-indigo-200 border border-indigo-150 dark:border-slate-750 font-sans font-bold text-xs flex items-center justify-between shadow-sm cursor-pointer transition-all duration-200 group"
              title="Show All & Maximize Navigation View"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 rounded-lg text-white shadow-sm shadow-indigo-500/25">
                  <LayoutGrid className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div className="leading-tight">
                  <span className="block">Maximize View</span>
                  <span className="block text-[9px] font-medium text-indigo-500/80 dark:text-indigo-300">Launchpad Hub</span>
                </div>
              </div>
              <span className="text-[9px] font-extrabold bg-indigo-200/60 dark:bg-slate-700/60 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 rounded uppercase tracking-wider group-hover:scale-105 transition-transform">
                Show All
              </span>
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider block px-2">
              Management Modules
            </span>

            <nav className="space-y-1 text-xs">
              {canAccessTab('dashboard') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('dashboard')}`}
                >
                  <LayoutDashboard className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-blue-500'}`} />
                  Enterprise Dashboard
                </button>
              )}

              {canAccessTab('pos') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pos')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('pos')}`}
                >
                  <ShoppingCart className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'pos' ? 'text-white' : 'text-emerald-500'}`} />
                  POS Terminal
                </button>
              )}

              {canAccessTab('online-orders') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('online-orders')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('online-orders')}`}
                >
                  <ShoppingBag className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'online-orders' ? 'text-white' : 'text-teal-500'}`} />
                  Online Customer Orders
                </button>
              )}

              {canAccessTab('sales-history') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('sales-history')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('sales-history')}`}
                >
                  <History className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'sales-history' ? 'text-white' : 'text-amber-500'}`} />
                  Sales History
                </button>
              )}

              {canAccessTab('inventory') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('inventory')}`}
                >
                  <Package className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'inventory' ? 'text-white' : 'text-indigo-500'}`} />
                  Inventory
                </button>
              )}

              {canAccessTab('bincards') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('bincards')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('bincards')}`}
                >
                  <BookOpen className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'bincards' ? 'text-white' : 'text-cyan-500'}`} />
                  Bin Card
                </button>
              )}

              {canAccessTab('transfers') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('transfers')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('transfers')}`}
                >
                  <ArrowRightLeft className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'transfers' ? 'text-white' : 'text-purple-500'}`} />
                  Stock Transfers
                </button>
              )}

              {canAccessTab('credit-ledger') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('credit-ledger')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('credit-ledger')}`}
                >
                  <CreditCard className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'credit-ledger' ? 'text-white' : 'text-rose-500'}`} />
                  Credit Ledger
                </button>
              )}

              {canAccessTab('expenses') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('expenses')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('expenses')}`}
                >
                  <Receipt className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'expenses' ? 'text-white' : 'text-red-500'}`} />
                  Expense Registry
                </button>
              )}

              {canAccessTab('customers') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('customers')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('customers')}`}
                >
                  <Users className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'customers' ? 'text-white' : 'text-sky-500'}`} />
                  Loyalty Customers
                </button>
              )}

              {canAccessTab('finances') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('finances')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('finances')}`}
                >
                  <Wallet className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'finances' ? 'text-white' : 'text-yellow-500'}`} />
                  Financials
                </button>
              )}

              {canAccessTab('voice-assistance') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('voice-assistance')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('voice-assistance')}`}
                >
                  <Mic className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'voice-assistance' ? 'text-white' : 'text-emerald-500'}`} />
                  AI Voice Assistant
                </button>
              )}

              {canAccessTab('teleconsultation') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('teleconsultation')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between font-sans font-semibold transition-all cursor-pointer ${getTabStyles('teleconsultation')}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Stethoscope className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'teleconsultation' ? 'text-white' : 'text-purple-500'}`} />
                    <span>Pharmacist Teleconsult</span>
                  </div>
                  {queuedTeleCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full animate-bounce shadow-sm">
                      {queuedTeleCount}
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>

          <div className="space-y-1.5 border-t border-gray-100 dark:border-slate-800 pt-5">
            <span className="text-[10px] font-mono uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider block px-2">
              System Administration
            </span>
            <nav className="space-y-1 text-xs">
              {canAccessTab('categories') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('categories')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('categories')}`}
                >
                  <FolderTree className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'categories' ? 'text-white' : 'text-emerald-500'}`} />
                  Category Management
                </button>
              )}

              {canAccessTab('admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('admin')}`}
                >
                  <Shield className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'admin' ? 'text-white' : 'text-slate-500'}`} />
                  Security &amp; Audit Logs
                </button>
              )}

              {currentUser.role === 'Super Administrator' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('backup')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('backup')}`}
                >
                  <Database className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'backup' ? 'text-white' : 'text-zinc-500'}`} />
                  Relational Backup Wizard
                </button>
              )}

              {currentUser.role === 'Super Administrator' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-sans font-semibold transition-all cursor-pointer ${getTabStyles('docs')}`}
                >
                  <BookOpen className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'docs' ? 'text-white' : 'text-emerald-500'}`} />
                  Developer Documentation
                </button>
              )}
            </nav>
          </div>

          <PharmacyNotes 
            notes={pharmacyNotes} 
            currentUser={currentUser} 
            users={users}
            onRefreshNotes={refreshPharmacyNotes} 
          />

          <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 p-3 rounded-lg border border-emerald-150 dark:border-emerald-900/55 text-[11px] leading-relaxed font-sans mt-6 transition-colors duration-200">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-450 shrink-0 mb-1" />
            <span className="font-semibold block">State Sync Mode</span>
            ERP engine maintains a real relational-style file ledger in the Node.js container for persistence!
          </div>

          <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[11px] text-emerald-950 dark:text-emerald-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>Software by Sonan</span>
            </div>
            <p className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 leading-tight">
              Enterprise Pharmacy ERP &amp; Healthcare Management System
            </p>
          </div>

        </aside>

        {/* Panel Container Panel */}
        <main className="flex-1 p-3 sm:p-6 pb-24 md:pb-6 overflow-y-auto max-w-full">

          {activeTab === 'dashboard' && (
            <EnterpriseDashboard 
              sales={targetSales} 
              stockItems={targetInventory} 
              medicines={medicines} 
              branches={branches} 
              suppliers={suppliers} 
              currentUser={currentUser} 
              onDataChanged={handleSilentSync} 
              activeBranchId={activeBranchContext}
              allSales={sales}
            />
          )}

          {activeTab === 'pos' && (
            <PosTerminal 
              currentUser={currentUser} 
              medicines={medicines} 
              stockItems={stockItems} 
              customers={customers} 
              onSaleCompleted={handleSilentSync} 
              activeBranchId={activeBranchContext}
              branches={branches}
              pendingOnlineOrder={pendingOnlineOrderToPos}
              onClearPendingOnlineOrder={() => setPendingOnlineOrderToPos(null)}
            />
          )}

          {activeTab === 'online-orders' && (
            <OnlineOrdersPanel 
              currentUser={currentUser} 
              activeBranchId={activeBranchContext}
              onNavigateToPosWithOrder={(order) => {
                setPendingOnlineOrderToPos(order);
                setActiveTab('pos');
              }}
            />
          )}

          {activeTab === 'sales-history' && (
            <SalesHistoryPanel 
              currentUser={currentUser} 
              onDataChanged={handleSilentSync} 
              sales={sales}
              medicines={medicines}
              cashiers={users}
              branches={branches}
              activeBranchId={activeBranchContext}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryManager 
              currentUser={currentUser} 
              medicines={medicines} 
              stockItems={stockItems} 
              suppliers={suppliers} 
              onDataChanged={handleSilentSync} 
              activeBranchId={activeBranchContext}
              sales={sales}
              categories={categories}
            />
          )}

          {activeTab === 'bincards' && (
            <BinCardsPanel 
              currentUser={currentUser} 
              medicines={medicines} 
              stockItems={stockItems} 
              branches={branches} 
            />
          )}

          {activeTab === 'transfers' && (
            <StockTransferPanel 
              currentUser={currentUser} 
              branches={branches} 
              medicines={medicines} 
              stockItems={stockItems} 
              transfers={transfers} 
              onDataChanged={handleSilentSync} 
            />
          )}

          {activeTab === 'customers' && (
            <CustomerManagerPanel 
              currentUser={currentUser} 
              customers={customers} 
              sales={targetSales}
              onDataChanged={handleSilentSync} 
            />
          )}

          {activeTab === 'finances' && (
            <FinancialManagerPanel 
              currentUser={currentUser} 
              branches={branches} 
              expenses={expenses} 
              stockItems={stockItems} 
              purchaseOrders={purchaseOrders} 
              onDataChanged={handleSilentSync} 
              sales={sales}
              suppliers={suppliers}
              medicines={medicines}
              users={users}
            />
          )}

          {activeTab === 'credit-ledger' && (
            <PurchaseManagerPanel 
              currentUser={currentUser} 
              branches={branches} 
              medicines={medicines} 
              suppliers={suppliers} 
              purchaseOrders={purchaseOrders} 
              onDataChanged={handleSilentSync}
              defaultSubModule="suppliers"
              hideTabs={true}
              activeBranchId={activeBranchContext}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpenseRegistryPanel 
              currentUser={currentUser} 
              branches={branches} 
              expenses={expenses} 
              onDataChanged={handleSilentSync} 
            />
          )}

          {activeTab === 'categories' && (
            <CategoryManagerPanel
              currentUser={currentUser}
              categories={categories}
              medicines={medicines}
              onDataChanged={handleSilentSync}
            />
          )}

          {activeTab === 'admin' && (
            <UserActivityPanel 
              currentUser={currentUser} 
              branches={branches} 
              users={users} 
              auditLogs={auditLogs} 
              onDataChanged={handleSilentSync} 
              medicines={medicines}
              stockItems={stockItems}
              suppliers={suppliers}
              sales={sales}
              pharmacyNotes={pharmacyNotes}
              categories={categories}
            />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreWizard 
              currentUser={currentUser} 
              onRestoreSuccess={handleSilentSync} 
            />
          )}

          {activeTab === 'docs' && (
            <SystemDocs />
          )}

          {activeTab === 'voice-assistance' && (
            <VoiceAssistancePanel 
              currentUser={currentUser}
              currentBranch={currentBranch}
              onRefreshData={handleSilentSync}
              onNavigate={(tab) => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              onToggleTheme={(t) => {
                setTheme(t);
              }}
              onToggleMaximize={() => setShowAllMaximize(true)}
              activeTheme={theme}
            />
          )}

          {activeTab === 'teleconsultation' && (
            <TeleconsultationManager 
              currentUser={currentUser} 
              initialSessionId={targetTeleSessionId}
              onClearInitialSessionId={() => setTargetTeleSessionId(null)}
            />
          )}

        </main>

      </div>

      {/* Maximized Launchpad Overlay */}
      {showAllMaximize && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-left animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-955 transition-colors">
              <div className="space-y-1">
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 font-extrabold px-3 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1">
                  <LayoutGrid className="h-3.5 w-3.5 stroke-[2.5]" />
                  Interactive Launchpad Center
                </span>
                <h3 className="text-base font-bold text-gray-950 dark:text-white uppercase tracking-wider">
                  Maximized Operations Control Hub
                </h3>
                <p className="text-[11px] text-gray-400">
                  Quick access to all licensed and authorized enterprise pharmacy modules.
                </p>
              </div>
              <button
                onClick={() => setShowAllMaximize(false)}
                className="p-2.5 rounded-full bg-gray-100 dark:bg-slate-850 hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-500 hover:text-gray-850 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer shadow-sm"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content grid */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-white dark:bg-slate-900">
              
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider px-2">
                  Standard Operations &amp; Modules
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Enterprise Dashboard */}
                  {canAccessTab('dashboard') && (
                    <button
                      onClick={() => { setActiveTab('dashboard'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-blue-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-blue-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-blue-600 rounded-xl text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <LayoutDashboard className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          Enterprise Dashboard
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Executive KPIs, sales performance &amp; store analytics overview.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* POS Terminal */}
                  {canAccessTab('pos') && (
                    <button
                      onClick={() => { setActiveTab('pos'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-emerald-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-emerald-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-emerald-500 rounded-xl text-white shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <ShoppingCart className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          POS Sales Terminal
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Instant checkout register, medicine search &amp; invoicing.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Sales History */}
                  {canAccessTab('sales-history') && (
                    <button
                      onClick={() => { setActiveTab('sales-history'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-amber-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-amber-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-amber-500 rounded-xl text-white shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <History className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          Sales History Log
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Historical transaction records, receipt voiding &amp; audits.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Inventory */}
                  {canAccessTab('inventory') && (
                    <button
                      onClick={() => { setActiveTab('inventory'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-indigo-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-indigo-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-sm shadow-indigo-550/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Package className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          Drug Inventory
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Active stock levels, drug details &amp; expiration controls.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Bin Cards */}
                  {canAccessTab('bincards') && (
                    <button
                      onClick={() => { setActiveTab('bincards'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-cyan-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-cyan-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-cyan-500 rounded-xl text-white shadow-sm shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          Physical Bin Cards
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Traceable drug batch logs &amp; periodic receipt adjustments.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Stock Transfers */}
                  {canAccessTab('transfers') && (
                    <button
                      onClick={() => { setActiveTab('transfers'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-purple-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-purple-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-purple-500 rounded-xl text-white shadow-sm shadow-purple-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <ArrowRightLeft className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          Stock Transfers
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Manage inter-branch medicine movements and transits.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Credit Ledger */}
                  {canAccessTab('credit-ledger') && (
                    <button
                      onClick={() => { setActiveTab('credit-ledger'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-rose-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-rose-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-rose-500 rounded-xl text-white shadow-sm shadow-rose-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          Credit Ledger (Suppliers)
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Supplier bills, payments and credit ledger balances.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Expenses */}
                  {canAccessTab('expenses') && (
                    <button
                      onClick={() => { setActiveTab('expenses'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-red-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-red-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-red-500 rounded-xl text-white shadow-sm shadow-red-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Receipt className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          Expense Registry
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Log, review &amp; categorize all corporate expenditures.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Loyalty Customers */}
                  {canAccessTab('customers') && (
                    <button
                      onClick={() => { setActiveTab('customers'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-sky-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-sky-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-sky-500 rounded-xl text-white shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Users className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          Loyalty Program
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Manage loyal customers, tiers, purchases &amp; discounts.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Financials */}
                  {canAccessTab('finances') && (
                    <button
                      onClick={() => { setActiveTab('finances'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-amber-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-amber-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-amber-600 rounded-xl text-white shadow-sm shadow-amber-600/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Wallet className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          Financial Registry
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Financial audits, Profit &amp; Loss indices, and Sourcing performance metrics.
                        </span>
                      </div>
                    </button>
                  )}

                  {/* AI Voice Assistant */}
                  {canAccessTab('voice-assistance') && (
                    <button
                      onClick={() => { setActiveTab('voice-assistance'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-emerald-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-emerald-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4 animate-pulse hover:animate-none"
                    >
                      <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-sm shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Mic className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          AI Voice Assistant
                        </span>
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed truncate font-semibold">
                          Microphone speech command and voice ERP synthesizer feed!
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Pharmacist Teleconsultation */}
                  {canAccessTab('teleconsultation') && (
                    <button
                      onClick={() => { setActiveTab('teleconsultation'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-purple-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-purple-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-purple-600 rounded-xl text-white shadow-sm shadow-purple-600/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Stethoscope className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          Pharmacist Teleconsult
                        </span>
                        <span className="block text-[10px] text-purple-600 dark:text-purple-400 leading-relaxed truncate font-semibold">
                          Live chat & video sessions for patient medication side effects & usage queries.
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Administration section if super admin or has security/admin capability */}
              {(currentUser?.role === 'Super Administrator' || canAccessTab('admin')) && (
                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <h4 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider px-2">
                    System Administration Modules
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Category Management */}
                    <button
                      onClick={() => { setActiveTab('categories'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-emerald-50/50 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-emerald-200 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-sm shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <FolderTree className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Category Management
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Add, edit, structure product categories, subcategories &amp; items.
                        </span>
                      </div>
                    </button>

                    {/* Security & Audit logs */}
                    <button
                      onClick={() => { setActiveTab('admin'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-slate-100 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-slate-300 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-slate-700 rounded-xl text-white shadow-sm shadow-slate-700/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Shield className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-slate-700 dark:group-hover:text-slate-400 transition-colors">
                          Security &amp; Audit Logs
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Review logs, trace operations, and manage database mutations.
                        </span>
                      </div>
                    </button>

                    {/* Backup Restore wizard */}
                    <button
                      onClick={() => { setActiveTab('backup'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-zinc-100 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-zinc-300 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-zinc-700 rounded-xl text-white shadow-sm shadow-zinc-700/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <Database className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-zinc-700 dark:group-hover:text-zinc-400 transition-colors">
                          Database Backup Wizard
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Manually backup ledger databases and perform recovery.
                        </span>
                      </div>
                    </button>

                    {/* Developer Documentation */}
                    <button
                      onClick={() => { setActiveTab('docs'); setShowAllMaximize(false); }}
                      className="group p-4 bg-gray-50 hover:bg-emerald-100 dark:bg-slate-955 dark:hover:bg-slate-850/65 rounded-2xl border border-gray-150 hover:border-emerald-300 dark:border-slate-850 dark:hover:border-slate-750 text-left transition-all duration-250 hover:shadow-md cursor-pointer flex gap-4"
                    >
                      <div className="p-3 bg-emerald-700 rounded-xl text-white shadow-sm shadow-emerald-700/20 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center h-12 w-12">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <span className="block font-sans font-bold text-xs text-gray-950 dark:text-white uppercase tracking-wider group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          Developer Docs
                        </span>
                        <span className="block text-[10px] text-gray-400 leading-relaxed truncate">
                          Comprehensive schema, triggers, and relational mechanics indices.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Automatic Daily Backup Background Execution Manager */}
      <AutoBackupManager currentUser={currentUser} />

      {/* Share Customer Online Store Modal in Header */}
      {showAppShareModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-500/20 text-xs">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex justify-between items-center relative">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                  <ShoppingBag className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Customer Online Store Link</h3>
                  <p className="text-[11px] text-emerald-200/80">Public catalog URL for patient mobile ordering</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAppShareModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-emerald-200 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5">
              
              {/* Branch Filter Selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Select Branch Catalog:
                </label>
                <select
                  value={appShareBranch}
                  onChange={(e) => setAppShareBranch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">🏬 All Pharmacy Branches Catalog</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>📍 {b.name} Branch</option>
                  ))}
                </select>
              </div>

              {/* URL Box */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-200 truncate select-all">
                    {getAppStoreUrl()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyAppStoreLink()}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 transition shadow"
                  >
                    {appCopiedLink ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                    <span>{appCopiedLink ? 'Store Link Copied!' : 'Copy Direct Link'}</span>
                  </button>
                  <a
                    href={getAppStoreUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg text-xs flex items-center space-x-1 border border-slate-200 dark:border-slate-700 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open</span>
                  </a>
                </div>
              </div>

              {/* QR Code Preview */}
              <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                {appQrUrl ? (
                  <img src={appQrUrl} alt="Store QR Code" className="w-44 h-44 mx-auto rounded-xl shadow border border-slate-200 dark:border-slate-600" />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs mx-auto">
                    Loading QR...
                  </div>
                )}
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  Scan QR code with phone camera to open online store
                </span>
              </div>

              {/* Social Sharing Grid */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block">
                  Share via Social Media:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => shareAppStoreToPlatform('whatsapp')}
                    className="py-2 px-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => shareAppStoreToPlatform('telegram')}
                    className="py-2 px-2.5 bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 hover:bg-sky-600 transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => shareAppStoreToPlatform('facebook')}
                    className="py-2 px-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 hover:bg-blue-700 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Facebook</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => shareAppStoreToPlatform('twitter')}
                    className="py-2 px-2.5 bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 hover:bg-slate-700 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>X</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => shareAppStoreToPlatform('email')}
                    className="py-2 px-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 hover:bg-amber-700 transition cursor-pointer col-span-2"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send via Email</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setShowAppShareModal(false)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Mobile Interactive Bottom Navigation Bar */}
      <nav 
        id="mobile-bottom-nav" 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-all"
        aria-label="Mobile Navigation"
      >
        {canAccessTab('dashboard') && (
          <button
            type="button"
            id="mobile-nav-dashboard"
            onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'dashboard' 
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 dark:bg-emerald-950/60 shadow-sm' : ''}`}>
              <LayoutDashboard className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Dashboard</span>
          </button>
        )}

        {canAccessTab('pos') && (
          <button
            type="button"
            id="mobile-nav-pos"
            onClick={() => { setActiveTab('pos'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'pos' 
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all ${activeTab === 'pos' ? 'bg-emerald-50 dark:bg-emerald-950/60 shadow-sm' : ''}`}>
              <ShoppingCart className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">POS</span>
          </button>
        )}

        {canAccessTab('inventory') && (
          <button
            type="button"
            id="mobile-nav-inventory"
            onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'inventory' 
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all ${activeTab === 'inventory' ? 'bg-emerald-50 dark:bg-emerald-950/60 shadow-sm' : ''}`}>
              <Package className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Inventory</span>
          </button>
        )}

        {canAccessTab('sales-history') && (
          <button
            type="button"
            id="mobile-nav-sales-history"
            onClick={() => { setActiveTab('sales-history'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'sales-history' 
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all ${activeTab === 'sales-history' ? 'bg-emerald-50 dark:bg-emerald-950/60 shadow-sm' : ''}`}>
              <History className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Sales</span>
          </button>
        )}

        {!canAccessTab('dashboard') && canAccessTab('customers') && (
          <button
            type="button"
            id="mobile-nav-customers"
            onClick={() => { setActiveTab('customers'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'customers' 
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 font-medium'
            }`}
          >
            <div className={`p-1 rounded-lg transition-all ${activeTab === 'customers' ? 'bg-emerald-50 dark:bg-emerald-950/60 shadow-sm' : ''}`}>
              <Users className="h-5 w-5 stroke-[2.2]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Customers</span>
          </button>
        )}

        <button
          type="button"
          id="mobile-nav-more"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative min-h-[44px] ${
            mobileMenuOpen 
              ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg transition-all ${mobileMenuOpen ? 'bg-indigo-50 dark:bg-indigo-950/60 shadow-sm' : ''}`}>
            <LayoutGrid className="h-5 w-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
          {queuedTeleCount > 0 && (
            <span className="absolute top-0.5 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>
      </nav>

      {/* Mobile Interactive Drawer Sheet Modal */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 overflow-hidden border-r border-gray-200 dark:border-slate-800 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                  <Building className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight leading-none">Sonan Pharmacy</h3>
                  <span className="text-[10px] text-emerald-100 font-mono mt-0.5 block">{currentUser.role}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* User Profile & Branch Selector */}
            <div className="p-3 bg-gray-50 dark:bg-slate-850 border-b border-gray-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700 dark:text-gray-200">{currentUser.name}</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-bold">
                  {currentUser.username}
                </span>
              </div>
              {(currentUser.role === 'Super Administrator' || currentUser.role === 'Auditor' || currentUser.role === 'Accountant') && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Branch:</span>
                  <select
                    value={activeBranchContext}
                    onChange={(e) => setActiveBranchContext(e.target.value)}
                    className="text-xs font-semibold bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 outline-none flex-1"
                  >
                    <option value="all">Enterprise (All)</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Scrollable Navigation List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider block px-2">
                  All System Modules
                </span>
                <nav className="space-y-1 text-xs">
                  {canAccessTab('dashboard') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('dashboard')}`}
                    >
                      <LayoutDashboard className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-blue-500'}`} />
                      <span>Enterprise Dashboard</span>
                    </button>
                  )}
                  {canAccessTab('pos') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('pos'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('pos')}`}
                    >
                      <ShoppingCart className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'pos' ? 'text-white' : 'text-emerald-500'}`} />
                      <span>POS Terminal</span>
                    </button>
                  )}
                  {canAccessTab('online-orders') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('online-orders'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('online-orders')}`}
                    >
                      <ShoppingBag className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'online-orders' ? 'text-white' : 'text-teal-500'}`} />
                      <span>Customer Online Orders</span>
                    </button>
                  )}
                  {canAccessTab('sales-history') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('sales-history'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('sales-history')}`}
                    >
                      <History className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'sales-history' ? 'text-white' : 'text-amber-500'}`} />
                      <span>Sales History &amp; Receipts</span>
                    </button>
                  )}
                  {canAccessTab('inventory') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('inventory')}`}
                    >
                      <Package className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'inventory' ? 'text-white' : 'text-indigo-500'}`} />
                      <span>Inventory &amp; Drug Directory</span>
                    </button>
                  )}
                  {canAccessTab('bincards') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('bincards'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('bincards')}`}
                    >
                      <BookOpen className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'bincards' ? 'text-white' : 'text-cyan-500'}`} />
                      <span>Bin Card Digital Ledger</span>
                    </button>
                  )}
                  {canAccessTab('transfers') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('transfers'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('transfers')}`}
                    >
                      <ArrowRightLeft className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'transfers' ? 'text-white' : 'text-purple-500'}`} />
                      <span>Inter-Branch Stock Transfers</span>
                    </button>
                  )}
                  {canAccessTab('credit-ledger') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('credit-ledger'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('credit-ledger')}`}
                    >
                      <CreditCard className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'credit-ledger' ? 'text-white' : 'text-rose-500'}`} />
                      <span>Credit Ledger &amp; Debts</span>
                    </button>
                  )}
                  {canAccessTab('expenses') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('expenses'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('expenses')}`}
                    >
                      <Receipt className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'expenses' ? 'text-white' : 'text-red-500'}`} />
                      <span>Expense Registry</span>
                    </button>
                  )}
                  {canAccessTab('customers') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('customers'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('customers')}`}
                    >
                      <Users className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'customers' ? 'text-white' : 'text-sky-500'}`} />
                      <span>Loyalty Customers</span>
                    </button>
                  )}
                  {canAccessTab('finances') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('finances'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('finances')}`}
                    >
                      <Wallet className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'finances' ? 'text-white' : 'text-yellow-500'}`} />
                      <span>Financials &amp; Reports</span>
                    </button>
                  )}
                  {canAccessTab('voice-assistance') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('voice-assistance'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('voice-assistance')}`}
                    >
                      <Mic className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'voice-assistance' ? 'text-white' : 'text-emerald-500'}`} />
                      <span>AI Voice Assistant</span>
                    </button>
                  )}
                  {canAccessTab('teleconsultation') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('teleconsultation'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between font-semibold transition-all cursor-pointer ${getTabStyles('teleconsultation')}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Stethoscope className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'teleconsultation' ? 'text-white' : 'text-purple-500'}`} />
                        <span>Pharmacist Teleconsult</span>
                      </div>
                      {queuedTeleCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full animate-bounce">
                          {queuedTeleCount}
                        </span>
                      )}
                    </button>
                  )}
                  {canAccessTab('categories') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('categories'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('categories')}`}
                    >
                      <FolderTree className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'categories' ? 'text-white' : 'text-emerald-500'}`} />
                      <span>Category Management</span>
                    </button>
                  )}
                  {canAccessTab('admin') && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('admin')}`}
                    >
                      <Shield className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'admin' ? 'text-white' : 'text-slate-500'}`} />
                      <span>Security &amp; Audit Logs</span>
                    </button>
                  )}
                  {currentUser.role === 'Super Administrator' && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('backup'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('backup')}`}
                    >
                      <Database className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'backup' ? 'text-white' : 'text-zinc-500'}`} />
                      <span>Relational Backup Wizard</span>
                    </button>
                  )}
                  {currentUser.role === 'Super Administrator' && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('docs'); setMobileMenuOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 font-semibold transition-all cursor-pointer ${getTabStyles('docs')}`}
                    >
                      <BookOpen className={`h-4.5 w-4.5 shrink-0 ${activeTab === 'docs' ? 'text-white' : 'text-emerald-500'}`} />
                      <span>Developer Documentation</span>
                    </button>
                  )}
                </nav>
              </div>

              {/* Mobile Quick Actions */}
              <div className="pt-2 border-t border-gray-200 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => { setShowAppShareModal(true); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-800/40"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share Customer Store Link</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 px-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-800/40"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Mobile Footer Attribution */}
            <div className="p-3 bg-gray-50 dark:bg-slate-850 border-t border-gray-200 dark:border-slate-800 text-center">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Software by Sonan
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
