import React, { useState, useEffect } from 'react';
import { 
  Receipt, AlertTriangle, Clock, Calendar, CheckCircle2, 
  X, Filter, DollarSign, Building, Phone, ChevronRight, 
  CreditCard, RefreshCw, FileText, ArrowUpRight, Search,
  BellRing, ShieldAlert
} from 'lucide-react';
import { User, Supplier, Branch, SupplierTransaction } from '../types.ts';

export interface OutboundCreditNotification {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  reference?: string;
  invoiceDate: string;
  dueDate?: string;
  paymentTerms?: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue';
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  daysDiff: number; // negative = overdue, positive = days left
  branchId?: string;
}

export interface SupplierCreditTotalItem {
  supplierId: string;
  supplierName: string;
  phone: string;
  email?: string;
  address?: string;
  totalCreditPurchased: number;
  totalPaid: number;
  outstandingBalance: number;
  supplierOverdue: number;
  supplierDueSoon: number;
  totalCreditInvoicesCount: number;
  activeCreditInvoicesCount: number;
  overdueInvoicesCount: number;
}

interface OutboundCreditNotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  suppliers: Supplier[];
  branches: Branch[];
  activeBranchId?: string;
  onOpenSupplierLedger?: (supplierId?: string) => void;
  onOpenPaymentModal?: (supplierId: string, creditTxId?: string, amount?: number) => void;
  onDataChanged?: () => void;
}

export const OutboundCreditNotificationPanel: React.FC<OutboundCreditNotificationPanelProps> = ({
  isOpen,
  onClose,
  currentUser,
  suppliers = [],
  branches = [],
  activeBranchId,
  onOpenSupplierLedger,
  onOpenPaymentModal,
  onDataChanged
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'due_soon' | 'by_supplier'>('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'invoices' | 'suppliers_summary'>('invoices');
  
  const [summaryData, setSummaryData] = useState<{
    totalOutboundCredit: number;
    totalOverdue: number;
    totalDueSoon: number;
    totalActiveInvoices: number;
    supplierCreditTotals: SupplierCreditTotalItem[];
    notifications: OutboundCreditNotification[];
  }>({
    totalOutboundCredit: 0,
    totalOverdue: 0,
    totalDueSoon: 0,
    totalActiveInvoices: 0,
    supplierCreditTotals: [],
    notifications: []
  });

  const fetchOutboundSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/suppliers/outbound-credit-summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      } else {
        // Fallback calculation from local suppliers if endpoint fails
        calculateLocalSummary();
      }
    } catch (err) {
      console.error('Failed to fetch outbound credit summary:', err);
      calculateLocalSummary();
    } finally {
      setLoading(false);
    }
  };

  const calculateLocalSummary = () => {
    const today = new Date().toISOString().split('T')[0];
    const totalOutbound = suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
    
    const supplierTotals: SupplierCreditTotalItem[] = suppliers.map(s => ({
      supplierId: s.id,
      supplierName: s.name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      totalCreditPurchased: s.balance || 0,
      totalPaid: 0,
      outstandingBalance: s.balance || 0,
      supplierOverdue: 0,
      supplierDueSoon: 0,
      totalCreditInvoicesCount: s.balance > 0 ? 1 : 0,
      activeCreditInvoicesCount: s.balance > 0 ? 1 : 0,
      overdueInvoicesCount: 0
    }));

    setSummaryData({
      totalOutboundCredit: totalOutbound,
      totalOverdue: 0,
      totalDueSoon: 0,
      totalActiveInvoices: suppliers.filter(s => s.balance > 0).length,
      supplierCreditTotals: supplierTotals,
      notifications: suppliers.filter(s => s.balance > 0).map((s, idx) => ({
        id: `local_notif_${s.id}`,
        supplierId: s.id,
        supplierName: s.name,
        supplierPhone: s.phone,
        reference: `Credit Balance`,
        invoiceDate: today,
        amount: s.balance,
        paidAmount: 0,
        remainingAmount: s.balance,
        paymentStatus: 'Pending',
        isOverdue: false,
        isDueToday: false,
        isDueSoon: false,
        daysDiff: 0
      }))
    });
  };

  useEffect(() => {
    if (isOpen) {
      fetchOutboundSummary();
    }
  }, [isOpen]);

  const handleTogglePaid = async (txId: string) => {
    try {
      const res = await fetch(`/api/suppliers/transactions/${txId}/toggle-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser.id })
      });
      if (res.ok) {
        fetchOutboundSummary();
        if (onDataChanged) onDataChanged();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  // Filtered notifications
  const filteredNotifications = summaryData.notifications.filter(item => {
    if (activeBranchId && activeBranchId !== 'all' && item.branchId && item.branchId !== activeBranchId) {
      return false;
    }
    if (filterType === 'overdue' && !item.isOverdue) return false;
    if (filterType === 'due_soon' && !item.isDueSoon && !item.isDueToday) return false;
    if (selectedSupplierFilter !== 'all' && item.supplierId !== selectedSupplierFilter) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSup = item.supplierName.toLowerCase().includes(q);
      const matchRef = (item.reference || '').toLowerCase().includes(q);
      if (!matchSup && !matchRef) return false;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="outbound-credit-notification-drawer"
        className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300 text-slate-800 dark:text-slate-100"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Outbound Credit Notification Panel</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-xs">
                  Payables Alert
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Supplier debt, credit invoices, and approaching payment settlement dates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchOutboundSummary}
              disabled={loading}
              title="Refresh credit alerts"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close Notification Panel"
              className="p-2 text-slate-300 hover:text-white hover:bg-rose-600/40 rounded-lg transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Metrics Row */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Outbound Debt</span>
            <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
              {summaryData.totalOutboundCredit.toLocaleString('en-US')} ETB
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Overdue Credit
            </span>
            <span className="text-base font-black text-rose-700 dark:text-rose-300 font-mono">
              {summaryData.totalOverdue.toLocaleString('en-US')} ETB
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block flex items-center gap-1">
              <Clock className="h-3 w-3" /> Due in 7 Days
            </span>
            <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
              {summaryData.totalDueSoon.toLocaleString('en-US')} ETB
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Invoices</span>
            <span className="text-base font-black text-slate-800 dark:text-slate-200 font-mono">
              {summaryData.totalActiveInvoices} Pending
            </span>
          </div>
        </div>

        {/* View Mode Switcher (Invoices Alerts vs Separate Suppliers Breakdown) */}
        <div className="px-4 pt-3 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pb-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('invoices')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                viewMode === 'invoices'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Credit Invoices ({summaryData.notifications.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('suppliers_summary')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                viewMode === 'suppliers_summary'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Building className="h-3.5 w-3.5" />
              <span>By Supplier Separately ({summaryData.supplierCreditTotals.length})</span>
            </button>
          </div>

          {onOpenSupplierLedger && (
            <button
              type="button"
              onClick={() => {
                onOpenSupplierLedger();
                onClose();
              }}
              className="hidden sm:flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
            >
              <span>Full Ledger</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {viewMode === 'invoices' ? (
            <>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                    filterType === 'all'
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  All ({summaryData.notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('overdue')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] flex items-center gap-1 ${
                    filterType === 'overdue'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-rose-600 border border-rose-200 dark:border-rose-900'
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Overdue ({summaryData.notifications.filter(n => n.isOverdue).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('due_soon')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-[11px] flex items-center gap-1 ${
                    filterType === 'due_soon'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-amber-700 border border-amber-200 dark:border-amber-900'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Due Soon ({summaryData.notifications.filter(n => n.isDueSoon || n.isDueToday).length})
                </button>
              </div>

              {/* Supplier Filter & Search */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedSupplierFilter}
                  onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold px-2 py-1 rounded-lg outline-none cursor-pointer flex-1 sm:flex-none"
                >
                  <option value="all">All Suppliers</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="relative flex-1 sm:w-36">
                  <Search className="h-3 w-3 text-slate-400 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Search invoice..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] pl-6 pr-2 py-1 outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-slate-500 font-semibold text-[11px]">
                Showing complete credit breakdown for each supplier separately:
              </span>
              <div className="relative w-48">
                <Search className="h-3 w-3 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Filter supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] pl-6 pr-2 py-1 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {viewMode === 'invoices' ? (
            /* INVOICE ALERTS LIST */
            filteredNotifications.length > 0 ? (
              filteredNotifications.map((notif) => {
                const isOverdue = notif.isOverdue;
                const isDueToday = notif.isDueToday;
                const isDueSoon = notif.isDueSoon;

                return (
                  <div 
                    key={notif.id}
                    className={`p-3.5 rounded-xl border transition-all shadow-xs ${
                      isOverdue 
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60' 
                        : isDueToday 
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {notif.supplierName}
                          </span>
                          {notif.supplierPhone && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              ({notif.supplierPhone})
                            </span>
                          )}
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              OVERDUE BY {Math.abs(notif.daysDiff)} DAYS
                            </span>
                          )}
                          {isDueToday && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-600 text-white flex items-center gap-1 shadow-xs">
                              <Clock className="h-2.5 w-2.5" />
                              DUE TODAY
                            </span>
                          )}
                          {!isOverdue && !isDueToday && isDueSoon && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                              Due in {notif.daysDiff} days
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-3 flex-wrap">
                          <span className="font-mono font-semibold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                            Ref: {notif.reference || 'PO Credit'}
                          </span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            Issued: {notif.invoiceDate}
                          </span>
                          {notif.dueDate && (
                            <span className={`flex items-center gap-1 text-[11px] font-semibold ${
                              isOverdue ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
                            }`}>
                              Due: {notif.dueDate}
                            </span>
                          )}
                          {notif.paymentTerms && (
                            <span className="text-[10px] bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                              {notif.paymentTerms}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Financial Figures */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Balance Due</span>
                        <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono block">
                          {notif.remainingAmount.toLocaleString('en-US')} ETB
                        </span>
                        {notif.paidAmount > 0 && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Paid: {notif.paidAmount.toLocaleString()} / Total: {notif.amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(notif.id)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer flex items-center gap-1"
                          title="Toggle settlement status directly"
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Mark Paid</span>
                        </button>

                        {onOpenSupplierLedger && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenSupplierLedger(notif.supplierId);
                              onClose();
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition cursor-pointer"
                          >
                            View Ledger
                          </button>
                        )}
                      </div>

                      {onOpenPaymentModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenPaymentModal(notif.supplierId, notif.id, notif.remainingAmount);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Settle & Pay {notif.remainingAmount.toLocaleString()} ETB</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Pending Outbound Credit Alerts</p>
                <p className="text-xs text-slate-500">All supplier credit invoices are fully settled or no debts match filter.</p>
              </div>
            )
          ) : (
            /* SEPARATE TOTAL CREDIT PER SUPPLIER VIEW */
            summaryData.supplierCreditTotals
              .filter(s => {
                if (!searchQuery.trim()) return true;
                return s.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       (s.phone && s.phone.includes(searchQuery));
              })
              .map(sup => (
                <div 
                  key={sup.supplierId}
                  className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {sup.supplierName}
                        </span>
                        {sup.overdueInvoicesCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                            {sup.overdueInvoicesCount} Overdue
                          </span>
                        )}
                        {sup.outstandingBalance === 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Clear / Paid
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span className="font-mono">{sup.phone || 'No phone'}</span>
                        <span>•</span>
                        <span>{sup.address || 'No address'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Balance Owed</span>
                      <span className={`text-base font-black font-mono block ${
                        sup.outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                      }`}>
                        {sup.outstandingBalance.toLocaleString('en-US')} ETB
                      </span>
                    </div>
                  </div>

                  {/* 3-Column Financial Breakdown for each supplier */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg text-xs border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Credit Incurred</span>
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                        {sup.totalCreditPurchased.toLocaleString('en-US')} ETB
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Payments Made</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {sup.totalPaid.toLocaleString('en-US')} ETB
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Overdue Portion</span>
                      <span className={`font-bold font-mono ${
                        sup.supplierOverdue > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        {sup.supplierOverdue.toLocaleString('en-US')} ETB
                      </span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      {sup.activeCreditInvoicesCount} active unpaid bill{sup.activeCreditInvoicesCount === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-2">
                      {onOpenSupplierLedger && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenSupplierLedger(sup.supplierId);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                        >
                          View Transactions
                        </button>
                      )}
                      {sup.outstandingBalance > 0 && onOpenPaymentModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenPaymentModal(sup.supplierId, undefined, sup.outstandingBalance);
                            onClose();
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <CreditCard className="h-3 w-3" />
                          <span>Pay Supplier</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-[11px]">
            Showing outbound credit obligations for verified suppliers.
          </div>
          {onOpenSupplierLedger && (
            <button
              type="button"
              onClick={() => {
                onOpenSupplierLedger();
                onClose();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Go to Supplier Accounts &amp; Ledgers</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
