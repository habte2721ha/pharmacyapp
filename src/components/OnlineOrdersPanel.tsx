import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Filter, Phone, MapPin, CheckCircle2, 
  XCircle, Clock, ExternalLink, Copy, Check, Eye, AlertCircle, 
  FileText, ArrowRight, User, RefreshCw, Send, DollarSign, PackageCheck,
  Share2, MessageSquare, Mail, QrCode, Download, Printer, X, Sparkles, Camera
} from 'lucide-react';
import QRCode from 'qrcode';
import { OnlineOrder } from '../types.ts';

interface OnlineOrdersPanelProps {
  currentUser: any;
  activeBranchId?: string;
  onNavigateToPosWithOrder?: (order: OnlineOrder) => void;
}

export default function OnlineOrdersPanel({ 
  currentUser, 
  activeBranchId,
  onNavigateToPosWithOrder 
}: OnlineOrdersPanelProps) {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [quotePriceInput, setQuotePriceInput] = useState<string>('');
  const [adminNotesInput, setAdminNotesInput] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Sync inputs when selected order changes
  useEffect(() => {
    if (selectedOrder) {
      setQuotePriceInput(selectedOrder.quotedPrice ? String(selectedOrder.quotedPrice) : (selectedOrder.totalAmount ? String(selectedOrder.totalAmount) : ''));
      setAdminNotesInput(selectedOrder.adminNotes || '');
    }
  }, [selectedOrder]);

  const getPublicStoreUrl = () => {
    return `${window.location.origin}${window.location.pathname}?view=catalog`;
  };

  const handleOpenQrModal = async () => {
    const publicUrl = getPublicStoreUrl();
    try {
      const dataUrl = await QRCode.toDataURL(publicUrl, {
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
      console.error('Error generating QR code:', err);
      alert('Failed to generate QR code.');
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'pharmacy-online-store-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintQrFlyer = () => {
    const storeUrl = getPublicStoreUrl();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Online - Customer Store QR Code</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 40px;
              color: #0f172a;
              background-color: #f8fafc;
            }
            .card {
              max-width: 480px;
              margin: 0 auto;
              background: #ffffff;
              padding: 32px;
              border-radius: 24px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.08);
              border: 2px solid #e2e8f0;
            }
            h1 {
              color: #065f46;
              font-size: 26px;
              margin-bottom: 6px;
            }
            p.subtitle {
              color: #475569;
              font-size: 14px;
              margin-top: 0;
              margin-bottom: 24px;
            }
            .qr-frame {
              background: #ecfdf5;
              padding: 20px;
              border-radius: 20px;
              display: inline-block;
              border: 2px dashed #059669;
              margin-bottom: 20px;
            }
            .qr-frame img {
              width: 240px;
              height: 240px;
              display: block;
            }
            .instructions {
              font-size: 13px;
              font-weight: bold;
              color: #047857;
              background: #d1fae5;
              padding: 10px 16px;
              border-radius: 12px;
              display: inline-block;
              margin-bottom: 16px;
            }
            .url-text {
              font-family: monospace;
              font-size: 12px;
              color: #64748b;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🛍️ Order Online & Home Delivery</h1>
            <p class="subtitle">Browse Medicines & Cosmetics on Your Mobile Phone</p>
            
            <div class="qr-frame">
              <img src="${qrDataUrl}" alt="Store QR Code" />
            </div>

            <div class="instructions">
              📷 Scan this QR Code with your Phone Camera to Order Now!
            </div>

            <p class="url-text">${storeUrl}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Fetch orders from server
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/online-orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data || []);
      } else {
        setError('Failed to load online orders.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error while fetching online orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Copy Store Link to Clipboard
  const handleCopyStoreLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}?view=catalog`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const [copiedReceiptText, setCopiedReceiptText] = useState(false);

  const getOrderReceiptText = (order: OnlineOrder) => {
    const itemLines = order.items.map(i => `- ${i.medicineName}: ${i.quantity} x ${i.unitPrice} ETB = ${i.total} ETB`).join('\n');
    return `🛍️ *Sonan Pharmacy - Order Receipt #${order.orderNumber}*\n` +
      `-----------------------------------\n` +
      `👤 Customer: ${order.customerName}\n` +
      `📞 Phone: ${order.customerPhone}\n` +
      `📍 Delivery Address: ${order.deliveryAddress}\n` +
      `💵 Total Amount: ${order.totalAmount.toLocaleString()} ETB\n` +
      `📌 Status: ${order.status}\n` +
      `-----------------------------------\n` +
      `Items:\n${itemLines}`;
  };

  const handleShareToWhatsApp = (order: OnlineOrder) => {
    const text = getOrderReceiptText(order);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareToTelegram = (order: OnlineOrder) => {
    const text = getOrderReceiptText(order);
    const url = `${window.location.origin}${window.location.pathname}?view=catalog`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareToEmail = (order: OnlineOrder) => {
    const subject = `Pharmacy Order Receipt #${order.orderNumber}`;
    const body = getOrderReceiptText(order);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(order.customerEmail || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleCopyReceipt = (order: OnlineOrder) => {
    const text = getOrderReceiptText(order);
    navigator.clipboard.writeText(text);
    setCopiedReceiptText(true);
    setTimeout(() => setCopiedReceiptText(false), 2500);
  };

  // Open Public Store in New Window
  const handleOpenPublicStore = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}?view=catalog`;
    window.open(publicUrl, '_blank');
  };

  // Send Price Quote Response
  const handleSendPriceQuote = async (orderId: string) => {
    const numericPrice = parseFloat(quotePriceInput) || 0;
    if (numericPrice <= 0) {
      alert('Please enter a valid quoted price in ETB.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/online-orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Quote Sent',
          quotedPrice: numericPrice,
          totalAmount: numericPrice,
          adminNotes: adminNotesInput.trim(),
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
        setSelectedOrder(updated);
        alert(`Price quote of ${numericPrice} ETB recorded! You can now send the quote to the customer via WhatsApp, Telegram, or Call.`);
      } else {
        alert('Failed to send price quote.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating price quote.');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/online-orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          operatorId: currentUser?.id
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(updated);
        }
      } else {
        alert('Failed to update order status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered orders list
  const filteredOrders = orders.filter(ord => {
    const matchesSearch = 
      ord.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customerPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.deliveryAddress.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate status statistics
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const confirmedCount = orders.filter(o => o.status === 'Confirmed').length;
  const dispatchedCount = orders.filter(o => o.status === 'Dispatched').length;
  const completedCount = orders.filter(o => o.status === 'Completed').length;
  const totalRevenue = orders
    .filter(o => o.status === 'Completed')
    .reduce((acc, o) => acc + (o.totalAmount || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/50">Pending Verification</span>;
      case 'Quote Sent':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300/50">Price Quote Sent</span>;
      case 'Confirmed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/50">Confirmed</span>;
      case 'Dispatched':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300/50">Out for Delivery</span>;
      case 'Completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/50">Completed & Invoiced</span>;
      case 'Cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/50">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Customer Share Link Bar */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold text-emerald-200">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-300" />
            <span>External Customer Store & Orders Center</span>
          </div>
          <h2 className="text-2xl font-black">Customer Online Orders</h2>
          <p className="text-xs text-emerald-100/80 max-w-xl">
            Receive, verify, and fulfill orders placed directly by external customers through your public store ordering link.
          </p>
        </div>

        {/* Share Link Actions */}
        <div className="z-10 flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
          <div className="text-xs space-y-0.5">
            <span className="font-bold block text-white">Your Customer Order Link</span>
            <span className="text-[11px] text-emerald-200 font-mono opacity-90 block truncate max-w-[200px]">
              {window.location.origin}/?view=catalog
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenQrModal}
              className="px-3.5 py-2 bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-100 font-bold text-xs rounded-xl border border-emerald-300/30 transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
              title="Generate & View Store QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-300" />
              <span>Show QR Code</span>
            </button>

            <button
              type="button"
              onClick={handleCopyStoreLink}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Order Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPublicStore}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Pending Orders</span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{pendingCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Confirmed / Ready</span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{confirmedCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Out for Delivery</span>
            <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400">{dispatchedCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Completed Sales</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{totalRevenue.toLocaleString()} ETB</span>
          </div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search order #, customer, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
          {['all', 'Pending', 'Confirmed', 'Dispatched', 'Completed', 'Cancelled'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'All Orders' : st}
            </button>
          ))}
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchOrders}
          className="p-2 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Orders Table & List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">Loading customer orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-slate-400 p-6">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Online Customer Orders</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Share your store link with customers to start receiving orders online.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Order Ref #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Delivery Address</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white">
                      {ord.orderNumber}
                      {ord.prescriptionImage && (
                        <span className="block mt-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          📷 Rx Attached
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(ord.createdAt).toLocaleDateString()} {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{ord.customerName}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{ord.customerPhone}</span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {ord.deliveryAddress}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{ord.items.length} item(s)</span>
                      <span className="block text-[10px] text-slate-400 truncate max-w-[150px]">
                        {ord.items.map(i => i.medicineName).join(', ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                      {ord.totalAmount.toLocaleString()} ETB
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(ord.status)}
                    </td>

                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        View Details
                      </button>

                      {onNavigateToPosWithOrder && ord.status !== 'Completed' && ord.status !== 'Cancelled' && (
                        <button
                          onClick={async () => {
                            if (ord.status === 'Pending') {
                              await handleUpdateStatus(ord.id, 'Confirmed');
                            }
                            onNavigateToPosWithOrder(ord);
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-extrabold transition shadow-sm inline-flex items-center gap-1 cursor-pointer"
                          title="Accept order and open directly in POS Terminal to complete sale"
                        >
                          <span>Accept & Finish in POS ⚡</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-200">Online Customer Order</span>
                <h3 className="text-lg font-black">{selectedOrder.orderNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              
              {/* Customer & Delivery Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Customer Info</span>
                  <p className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{selectedOrder.customerName}</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-0.5">{selectedOrder.customerPhone}</p>
                  {selectedOrder.customerEmail && <p className="text-slate-500">{selectedOrder.customerEmail}</p>}
                </div>

                <div>
                  <span className="text-slate-400 font-bold block mb-1">Delivery Address & Notes</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{selectedOrder.deliveryAddress}</p>
                  {selectedOrder.notes && (
                    <p className="text-slate-500 italic mt-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      "{selectedOrder.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Prescription Attachment Preview */}
              {selectedOrder.prescriptionImage && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                      <Camera className="w-4 h-4 text-amber-600" /> Attached Prescription Document / Image File
                    </span>
                    <a
                      href={selectedOrder.prescriptionImage}
                      target="_blank"
                      rel="noreferrer"
                      download={`Prescription_${selectedOrder.orderNumber}`}
                      className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg font-extrabold flex items-center gap-1 shadow-sm transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Full Document / Download File
                    </a>
                  </div>

                  <div className="rounded-xl border border-amber-300/80 bg-slate-900/5 overflow-hidden p-2">
                    {selectedOrder.prescriptionImage.startsWith('data:application/pdf') ? (
                      <iframe
                        src={selectedOrder.prescriptionImage}
                        title="Attached Prescription PDF"
                        className="w-full h-80 rounded-lg border-0"
                      />
                    ) : (
                      <img
                        src={selectedOrder.prescriptionImage}
                        alt="Prescription Attachment"
                        className="w-full object-contain max-h-80 mx-auto rounded-lg shadow-inner bg-white dark:bg-slate-900"
                        onError={(e) => {
                          // Fallback if image fails to render directly
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Admin Price Quote Response Section */}
              {(selectedOrder.isPrescriptionQuoteRequest || selectedOrder.prescriptionImage || selectedOrder.totalAmount === 0 || selectedOrder.status === 'Pending' || selectedOrder.status === 'Quote Sent') && (
                <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-teal-600" />
                      <span>Admin Price Quote Response for Customer Order</span>
                    </span>
                    {selectedOrder.quotedPrice && selectedOrder.quotedPrice > 0 ? (
                      <span className="px-2.5 py-0.5 bg-teal-600 text-white font-bold rounded-full text-[10px]">
                        Quoted: {selectedOrder.quotedPrice.toLocaleString()} ETB
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Quoted Total Price (ETB) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 250.50"
                        value={quotePriceInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(',', '.');
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setQuotePriceInput(val);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Pharmacy Response Notes / Pricing Breakdown
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Amoxicillin 500mg = 150 ETB, Paracetamol = 50 ETB"
                        value={adminNotesInput}
                        onChange={(e) => setAdminNotesInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={actionLoading || !quotePriceInput || (parseFloat(quotePriceInput) || 0) <= 0}
                    onClick={() => handleSendPriceQuote(selectedOrder.id)}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow transition flex items-center justify-center space-x-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Save & Send Official Price Quote to Customer</span>
                  </button>
                </div>
              )}

              {/* Ordered Items Table */}
              <div>
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm mb-2">Ordered Items</h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Unit Price</th>
                        <th className="p-2.5">Qty</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedOrder.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{it.medicineName}</td>
                          <td className="p-2.5 text-slate-500">{it.category || 'General'}</td>
                          <td className="p-2.5">{it.unitPrice.toLocaleString()} ETB</td>
                          <td className="p-2.5 font-extrabold text-emerald-600">{it.quantity}</td>
                          <td className="p-2.5 text-right font-extrabold text-slate-900 dark:text-white">
                            {it.total.toLocaleString()} ETB
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-extrabold text-sm text-slate-700 dark:text-slate-300">Grand Total:</span>
                  <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                    {selectedOrder.totalAmount.toLocaleString()} ETB
                  </span>
                </div>
              </div>

              {/* Share Order Receipt Options */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Share Order Receipt to Social Media / Email:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleShareToWhatsApp(selectedOrder)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-center space-x-1.5 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => handleShareToTelegram(selectedOrder)}
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 text-xs font-bold rounded-xl border border-sky-200 dark:border-sky-800/60 flex items-center space-x-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-500" />
                    <span>Telegram</span>
                  </button>

                  <button
                    onClick={() => handleShareToEmail(selectedOrder)}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-bold rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-center space-x-1.5 transition"
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-600" />
                    <span>Email</span>
                  </button>

                  <button
                    onClick={() => handleCopyReceipt(selectedOrder)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 transition"
                  >
                    {copiedReceiptText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedReceiptText ? 'Receipt Copied!' : 'Copy Receipt'}</span>
                  </button>
                </div>
              </div>

              {/* Status Update Control Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="font-bold text-slate-500 block">Change Status & Process Order:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={actionLoading || selectedOrder.status === 'Confirmed'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Confirmed')}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition disabled:opacity-40"
                  >
                    Mark Confirmed
                  </button>

                  <button
                    disabled={actionLoading || selectedOrder.status === 'Dispatched'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Dispatched')}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition disabled:opacity-40"
                  >
                    Mark Out for Delivery
                  </button>

                  <button
                    disabled={actionLoading || selectedOrder.status === 'Completed'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Completed')}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-40"
                  >
                    Mark Completed
                  </button>

                  <button
                    disabled={actionLoading || selectedOrder.status === 'Cancelled'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Cancelled')}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition disabled:opacity-40"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {onNavigateToPosWithOrder && selectedOrder.status !== 'Completed' && (
                <button
                  onClick={async () => {
                    const ord = selectedOrder;
                    if (ord.status === 'Pending') {
                      await handleUpdateStatus(ord.id, 'Confirmed');
                    }
                    setSelectedOrder(null);
                    onNavigateToPosWithOrder(ord);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center space-x-2 cursor-pointer"
                >
                  <span>Accept Order & Process Directly in POS ⚡</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="ml-auto px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-300 transition"
              >
                Close
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
                  onClick={handleDownloadQr}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Image</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintQrFlyer}
                  className="py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Counter Flyer</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyStoreLink}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition border border-slate-200 dark:border-slate-700"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPublicStore}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition border border-slate-200 dark:border-slate-700"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                  <span>Open Online Store</span>
                </button>
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
