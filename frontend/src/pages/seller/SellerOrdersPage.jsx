import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  ShoppingBag,
  CheckCircle,
  Package,
  Truck,
  Store,
  IndianRupee,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  KeyRound,
  User,
  Calendar,
  Receipt,
  FileText,
  Search,
  Filter,
  X,
  ArrowRight,
  ExternalLink,
  Clock,
  ChevronRight,
  Phone,
  MapPin,
  Tag,
  Boxes,
  Eye,
  Sparkles,
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { orderService } from '../../services/orderService';
import { billingService } from '../../services/billingService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { BillReceiptModal } from '../../components/billing/BillReceiptModal';
import {
  SellerPageHeader,
  MerchantStatCard,
  StatusBadge,
} from '../../components/seller';

/**
 * Valid Next Order State Machine Transitions
 * Aligned with backend order.service.js allowed transitions
 */
const getNextStatus = (order) => {
  if (!order || !order.status) return null;
  if (order.status === 'PLACED') return 'CONFIRMED';
  if (order.status === 'CONFIRMED') return 'PACKED';
  if (order.status === 'PACKED') {
    return order.fulfillmentType === 'LOCAL_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY_FOR_PICKUP';
  }
  if (order.status === 'READY_FOR_PICKUP') return 'DELIVERED';
  if (order.status === 'OUT_FOR_DELIVERY') return 'DELIVERED';
  return null;
};

/**
 * SellerOrdersPage (Phase 9 Redesign)
 *
 * "Order Fulfillment & Pickup Command Center"
 * Purpose: FULFILLMENT OPERATIONS ("What order needs to move next?")
 *
 * Distinct from:
 * - FEFO Batches ("Which batch should I sell first?")
 * - Inventory & Stock ("How healthy is my overall inventory?")
 * - Expiry Alerts ("What requires my attention right now?")
 *
 * Features:
 * - 100% preservation of orderService, verifyPickupQr, and billingService
 * - Operational Fulfillment Pipeline visual rail (New -> Preparing -> Ready for Pickup -> Completed)
 * - Prominent "Ready for Pickup" Spotlight for rapid counter verification
 * - "Orders Requiring Attention" section for actionable pending tasks
 * - Signature QR Verification panel with Html5QrcodeScanner and manual token input
 * - Order detail modal with itemized allocations, savings, and timeline
 * - Itemized Tax Invoice & Bill Receipt integration
 * - Rich search and filter toolbar
 */
export const SellerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // ALL | NEEDS_ACTION | READY_PICKUP | PICKUP | LOCAL_DELIVERY | COMPLETED
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // QR Scanner & Verification State (100% Preserved)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'manual'
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [scanError, setScanError] = useState('');

  // Bill Receipt View State (100% Preserved)
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Order Details Modal State
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const scannerRef = useRef(null);

  // Fetch Orders
  const fetchOrders = async (isManualSync = false) => {
    try {
      if (isManualSync) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await orderService.getSellerOrders();
      setOrders(data?.orders || []);
    } catch (err) {
      console.error('Failed to retrieve store orders:', err);
      setError(err?.message || 'Unable to load store orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Initialize html5-qrcode scanner when scanner modal opens in camera mode
  useEffect(() => {
    if (!scannerOpen || scanMode !== 'camera' || verificationResult) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const container = document.getElementById('pickup-qr-reader');
      if (!container) return;

      try {
        const scanner = new Html5QrcodeScanner(
          'pickup-qr-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scanner.render(
          (decodedText) => {
            scanner.clear().catch(() => {});
            scannerRef.current = null;
            handleVerifyToken(decodedText);
          },
          () => {
            // Frame scan failures are continuous and safe to ignore
          }
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error('Failed to initialize camera scanner:', err);
        setScanMode('manual');
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scannerOpen, scanMode, verificationResult]);

  const handleOpenScanner = (order = null) => {
    setSelectedOrder(order);
    setScanError('');
    setVerificationResult(null);
    setManualToken('');
    setScanMode('camera');
    setScannerOpen(true);
  };

  const handleCloseScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setScannerOpen(false);
    setVerificationResult(null);
    setScanError('');
    setSelectedOrder(null);
  };

  const handleVerifyToken = async (tokenString) => {
    const token = (tokenString || manualToken || '').trim();
    if (!token) {
      setScanError('Please scan a QR code or enter a pickup verification token.');
      return;
    }

    try {
      setVerifying(true);
      setScanError('');
      const res = await orderService.verifyPickupQr(token);
      const verifiedData = res?.data || res;
      setVerificationResult(verifiedData);
      fetchOrders(true);
    } catch (err) {
      setScanError(err?.message || 'QR Verification failed. Please check token or order conditions.');
    } finally {
      setVerifying(false);
    }
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    try {
      setUpdatingOrderId(orderId);
      await orderService.updateOrderStatus(orderId, { status: nextStatus });
      await fetchOrders(true);
      if (detailOrder && detailOrder._id === orderId) {
        setDetailOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err) {
      alert(err?.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleOpenReceipt = async (orderId) => {
    try {
      const data = await billingService.getBillReceiptByOrderId(orderId);
      setSelectedReceipt(data?.receipt || data);
      setReceiptModalOpen(true);
    } catch (err) {
      console.error('Failed to load bill receipt:', err);
      alert('Failed to load bill receipt. Please try again.');
    }
  };

  const handleOpenDetails = (order) => {
    setDetailOrder(order);
    setDetailModalOpen(true);
  };

  // Helper: Format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Derived Pipeline & Metrics (Strictly from real order data)
  const pipelineMetrics = useMemo(() => {
    const newOrders = orders.filter((o) => o.status === 'PLACED' || o.status === 'CONFIRMED');
    const preparingOrders = orders.filter((o) => o.status === 'PACKED');
    const readyPickupOrders = orders.filter((o) => o.status === 'READY_FOR_PICKUP');
    const outDeliveryOrders = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY');
    const completedOrders = orders.filter((o) => o.status === 'DELIVERED');
    const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED');

    const sumVal = (arr) =>
      arr.reduce((acc, curr) => acc + (Number(curr.pricingSummary?.finalTotal) || 0), 0);

    const needsAttention = orders.filter(
      (o) =>
        o.status === 'PLACED' ||
        o.status === 'CONFIRMED' ||
        o.status === 'PACKED' ||
        o.status === 'READY_FOR_PICKUP'
    );

    return {
      newOrdersCount: newOrders.length,
      newValue: sumVal(newOrders),
      preparingCount: preparingOrders.length,
      preparingValue: sumVal(preparingOrders),
      readyPickupCount: readyPickupOrders.length,
      readyPickupValue: sumVal(readyPickupOrders),
      outDeliveryCount: outDeliveryOrders.length,
      completedCount: completedOrders.length,
      completedValue: sumVal(completedOrders),
      cancelledCount: cancelledOrders.length,
      needsAttentionCount: needsAttention.length,
      readyPickupOrders,
    };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const oNum = (ord.orderNumber || '').toLowerCase();
        const custName = (
          typeof ord.customerId === 'object' ? ord.customerId?.name || '' : ''
        ).toLowerCase();
        const custPhone = (
          typeof ord.customerId === 'object' ? ord.customerId?.phone || '' : ''
        ).toLowerCase();
        const itemNames = (ord.items || []).map((i) => i.productName.toLowerCase()).join(' ');

        const matches =
          oNum.includes(query) ||
          custName.includes(query) ||
          custPhone.includes(query) ||
          itemNames.includes(query);

        if (!matches) return false;
      }

      // 2. Active Tab Filter
      if (activeTab === 'NEEDS_ACTION') {
        const needs =
          ord.status === 'PLACED' ||
          ord.status === 'CONFIRMED' ||
          ord.status === 'PACKED' ||
          ord.status === 'READY_FOR_PICKUP';
        if (!needs) return false;
      } else if (activeTab === 'READY_PICKUP') {
        if (ord.status !== 'READY_FOR_PICKUP') return false;
      } else if (activeTab === 'PICKUP') {
        if (ord.fulfillmentType !== 'PICKUP') return false;
      } else if (activeTab === 'LOCAL_DELIVERY') {
        if (ord.fulfillmentType !== 'LOCAL_DELIVERY') return false;
      } else if (activeTab === 'COMPLETED') {
        if (ord.status !== 'DELIVERED') return false;
      }

      // 3. Status Dropdown
      if (statusFilter !== 'ALL' && ord.status !== statusFilter) {
        return false;
      }

      // 4. Payment Dropdown
      if (paymentFilter !== 'ALL' && ord.paymentStatus !== paymentFilter) {
        return false;
      }

      return true;
    });
  }, [orders, searchQuery, activeTab, statusFilter, paymentFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    activeTab !== 'ALL' ||
    statusFilter !== 'ALL' ||
    paymentFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setActiveTab('ALL');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header with Preserved Actions */}
      <SellerPageHeader
        badge="FULFILLMENT OPERATIONS"
        title="Store Orders"
        subtitle="Manage incoming orders, prepare pickups, verify QR tokens, and complete fulfillment with confidence."
        showEngineStatus={true}
        breadcrumbs={[
          { label: 'Seller Hub', href: '/seller/dashboard' },
          { label: 'Fulfillment Operations', href: '/seller/orders' },
          { label: 'Store Orders' },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenScanner()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-sm transition transform active:scale-95 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan Pickup QR</span>
            </button>

            <button
              type="button"
              onClick={() => fetchOrders(true)}
              disabled={refreshing || loading}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
              title="Sync Orders"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        }
      />

      {/* 2. Error Banner */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-rose-100 text-rose-600 mb-1">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-rose-900">Unable to load store orders</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => fetchOrders()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* 3. FULFILLMENT WORKFLOW BOARD (Connected Process Lanes) */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            <span className="flex items-center gap-2">
              <Boxes className="w-3.5 h-3.5 text-slate-400" />
              <span>Fulfillment Workflow Board</span>
            </span>
            <span className="font-mono text-slate-400">
              {pipelineMetrics.needsAttentionCount} Active in Pipeline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Lane 1: New / Placed */}
            <div
              onClick={() => {
                setActiveTab('NEEDS_ACTION');
                setStatusFilter('CONFIRMED');
              }}
              className={`p-3.5 sm:p-4 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/70 to-white hover:border-sky-300 transition-all cursor-pointer flex flex-col justify-between border-l-4 border-l-sky-500 ${
                activeTab === 'NEEDS_ACTION' && statusFilter === 'CONFIRMED' ? 'ring-2 ring-sky-400 shadow-sm' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-sky-800 uppercase tracking-wider bg-sky-100/80 px-2 py-0.5 rounded">
                  STEP 1 • NEW
                </span>
                <span className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {pipelineMetrics.newOrdersCount}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  ₹{pipelineMetrics.newValue.toFixed(2)} in queue
                </div>
              </div>
              <div className="mt-2.5 w-full bg-sky-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: pipelineMetrics.newOrdersCount > 0 ? '100%' : '0%' }} />
              </div>
            </div>

            {/* Lane 2: Preparing / Packed */}
            <div
              onClick={() => {
                setActiveTab('NEEDS_ACTION');
                setStatusFilter('PACKED');
              }}
              className={`p-3.5 sm:p-4 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/70 to-white hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between border-l-4 border-l-purple-500 ${
                activeTab === 'NEEDS_ACTION' && statusFilter === 'PACKED' ? 'ring-2 ring-purple-400 shadow-sm' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider bg-purple-100/80 px-2 py-0.5 rounded">
                  STEP 2 • PREPARING
                </span>
                <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                  <Package className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {pipelineMetrics.preparingCount}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  ₹{pipelineMetrics.preparingValue.toFixed(2)} staged
                </div>
              </div>
              <div className="mt-2.5 w-full bg-purple-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: pipelineMetrics.preparingCount > 0 ? '100%' : '0%' }} />
              </div>
            </div>

            {/* Lane 3: Ready for Pickup */}
            <div
              onClick={() => setActiveTab('READY_PICKUP')}
              className={`p-3.5 sm:p-4 rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50/80 to-white hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between border-l-4 border-l-amber-500 shadow-2xs ${
                activeTab === 'READY_PICKUP' ? 'ring-2 ring-amber-400 shadow-sm' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider bg-amber-200/80 px-2 py-0.5 rounded">
                    STEP 3 • READY PICKUP
                  </span>
                  {pipelineMetrics.readyPickupCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </div>
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                  <QrCode className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-amber-950 font-mono">
                  {pipelineMetrics.readyPickupCount}
                </div>
                <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                  ₹{pipelineMetrics.readyPickupValue.toFixed(2)} awaiting QR
                </div>
              </div>
              <div className="mt-2.5 w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: pipelineMetrics.readyPickupCount > 0 ? '100%' : '0%' }} />
              </div>
            </div>

            {/* Lane 4: Completed */}
            <div
              onClick={() => setActiveTab('COMPLETED')}
              className={`p-3.5 sm:p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between border-l-4 border-l-emerald-500 ${
                activeTab === 'COMPLETED' ? 'ring-2 ring-emerald-400 shadow-sm' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider bg-emerald-100/80 px-2 py-0.5 rounded">
                  STEP 4 • COMPLETED
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {pipelineMetrics.completedCount}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  ₹{pipelineMetrics.completedValue.toFixed(2)} fulfilled
                </div>
              </div>
              <div className="mt-2.5 w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: pipelineMetrics.completedCount > 0 ? '100%' : '0%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. COUNTER HANDOVER DESK (Signature Visual for Store Pickups) */}
      {!loading && !error && pipelineMetrics.readyPickupOrders.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-400 border-l-8 border-l-amber-500 p-5 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 shadow-xs flex-shrink-0 animate-pulse">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black tracking-wider uppercase text-amber-950 bg-amber-100 px-2 py-0.5 rounded">
                    COUNTER HANDOVER DESK
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 font-mono">
                    {pipelineMetrics.readyPickupOrders.length} WAITING
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Customers may arrive at the store counter. Verify their cryptographic QR code to release the items and record order completion.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenScanner()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer flex-shrink-0"
            >
              <QrCode className="w-4 h-4" />
              <span>Launch Counter Scanner</span>
            </button>
          </div>

          {/* Quick list of ready pickup orders */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {pipelineMetrics.readyPickupOrders.slice(0, 3).map((readyOrd) => {
              const custName =
                typeof readyOrd.customerId === 'object'
                  ? readyOrd.customerId?.name || 'Customer'
                  : 'Customer';

              return (
                <div
                  key={readyOrd._id}
                  className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-slate-900">
                        #{readyOrd.orderNumber}
                      </span>
                      <span className="text-[10px] font-black text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded uppercase">
                        PICKUP
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 font-bold truncate mt-1">
                      {custName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {readyOrd.items?.length || 0} items • ₹
                      {Number(readyOrd.pricingSummary?.finalTotal || 0).toFixed(2)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenScanner(readyOrd)}
                    className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-2xs transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Verify QR</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Filter & Search Toolbar */}
      {!loading && !error && orders.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
          {/* Top Row: Quick Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Orders ({orders.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NEEDS_ACTION')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'NEEDS_ACTION'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Needs Action ({pipelineMetrics.needsAttentionCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('READY_PICKUP')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'READY_PICKUP'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Ready for Pickup ({pipelineMetrics.readyPickupCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PICKUP')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'PICKUP'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Self Pickup</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('LOCAL_DELIVERY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'LOCAL_DELIVERY'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Local Delivery</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('COMPLETED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'COMPLETED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed ({pipelineMetrics.completedCount})</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>

          {/* Bottom Row: Search & Dropdowns */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by order #, customer name, phone, or item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="PLACED">Placed</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PACKED">Packed</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {/* Payment Dropdown */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Payments</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Loading State */}
      {loading && (
        <div className="py-16">
          <LoadingSpinner text="Retrieving store orders..." />
        </div>
      )}

      {/* 7. Fulfillment Orders Inbox / Queue */}
      {!loading && !error && filteredOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            <span>Fulfillment Order Queue</span>
            <span>{filteredOrders.length} Orders Listed</span>
          </div>

          <div className="space-y-3">
            {filteredOrders.map((ord) => {
              const nextStatus = getNextStatus(ord);
              const isPickup = ord.fulfillmentType === 'PICKUP';
              const isDelivered = ord.status === 'DELIVERED';
              const isReadyPickup = ord.status === 'READY_FOR_PICKUP';
              const isPreparing = ord.status === 'PACKED';
              const isNew = ord.status === 'PLACED' || ord.status === 'CONFIRMED';
              const custName =
                typeof ord.customerId === 'object'
                  ? ord.customerId?.name || 'Customer'
                  : 'Customer';
              const custPhone =
                typeof ord.customerId === 'object' ? ord.customerId?.phone : '';

              // Dynamic ticket border color based on fulfillment workflow stage
              const ticketRail = isReadyPickup
                ? 'border-l-amber-500 border-amber-300 bg-amber-50/15'
                : isPreparing
                ? 'border-l-purple-500 border-purple-200/90'
                : isNew
                ? 'border-l-sky-500 border-sky-200/90'
                : isDelivered
                ? 'border-l-emerald-500 border-emerald-200/90'
                : 'border-l-slate-400 border-slate-200/90';

              return (
                <div
                  key={ord._id}
                  className={`bg-white rounded-2xl border border-l-4 p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all space-y-3.5 ${ticketRail}`}
                >
                  {/* Ticket Header Stub */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        #{ord.orderNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        • {formatDate(ord.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Fulfillment Type Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isPickup
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isPickup ? (
                          <Store className="w-3 h-3 text-amber-700" />
                        ) : (
                          <Truck className="w-3 h-3 text-slate-600" />
                        )}
                        <span>{isPickup ? 'Self Pickup' : 'Local Delivery'}</span>
                      </span>

                      {/* Order Status Badge */}
                      <StatusBadge status={ord.status} size="sm" />

                      {/* Payment Status Badge */}
                      <StatusBadge
                        status={ord.paymentStatus}
                        label={ord.paymentStatus}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Customer & Handover Dispatch Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-900">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{custName}</span>
                      </span>
                      {custPhone && (
                        <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{custPhone}</span>
                        </span>
                      )}
                      {!isPickup && ord.deliveryAddress?.street && (
                        <span className="inline-flex items-center gap-1 text-slate-500 truncate max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {ord.deliveryAddress.street}, {ord.deliveryAddress.city}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item Breakdown Preview */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs font-mono">
                    {ord.items?.map((it) => (
                      <div
                        key={it._id}
                        className="flex justify-between items-center text-slate-700"
                      >
                        <span className="font-sans font-medium truncate max-w-md">
                          {it.productName} <span className="text-slate-400 font-mono">×</span>{' '}
                          <span className="font-bold text-slate-900 font-mono">{it.requestedQuantity}</span>
                        </span>
                        <span className="font-bold text-slate-900 flex-shrink-0">
                          ₹{Number(it.lineDiscountedAmount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Ticket Footer Financials & Workflow Actions */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                          Total Payable
                        </span>
                        <div className="font-black text-base sm:text-lg text-slate-900 font-mono">
                          ₹{Number(ord.pricingSummary?.finalTotal || 0).toFixed(2)}
                        </div>
                      </div>

                      {Number(ord.pricingSummary?.discounts || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Tag className="w-3 h-3 text-emerald-600" />
                          <span>Saved ₹{Number(ord.pricingSummary.discounts).toFixed(2)}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* View Details Modal Trigger */}
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(ord)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>Details</span>
                      </button>

                      {/* QR Action Button for Self-Pickup */}
                      {isPickup && !isDelivered && (
                        <button
                          type="button"
                          onClick={() => handleOpenScanner(ord)}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Verify QR</span>
                        </button>
                      )}

                      {/* View Billing Receipt for Delivered Orders */}
                      {isDelivered && (
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(ord._id)}
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Billing Receipt</span>
                        </button>
                      )}

                      {/* Advance State Machine Button */}
                      {nextStatus && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(ord._id, nextStatus)}
                          disabled={updatingOrderId === ord._id}
                          className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {updatingOrderId === ord._id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <span>Advance to {nextStatus.replace(/_/g, ' ')}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Empty States */}
      {!loading && !error && orders.length > 0 && filteredOrders.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-slate-100 text-slate-500 mb-1">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No orders match your current filters</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your search query, clearing status dropdowns, or switching back to "All Orders".
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="inline-flex p-4 rounded-3xl bg-slate-100 text-slate-600 border border-slate-200 mb-1">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Your Order Queue is Clear</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            No customer pickup or delivery reservations have arrived yet. When customers order near-expiry items from your store, they will appear here in real time.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => fetchOrders(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh Orders</span>
            </button>
          </div>
        </div>
      )}

      {/* 9. Order Details Modal */}
      {detailOrder && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setDetailOrder(null);
          }}
          title={`Order Details — #${detailOrder.orderNumber}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Meta Row */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                  Order Number
                </span>
                <span className="font-mono font-black text-sm text-slate-900">
                  #{detailOrder.orderNumber}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                  Created At
                </span>
                <span className="font-semibold text-slate-700">
                  {formatDate(detailOrder.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                  Fulfillment Status
                </span>
                <StatusBadge status={detailOrder.status} size="sm" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                  Payment Status
                </span>
                <StatusBadge status={detailOrder.paymentStatus} size="sm" />
              </div>
            </div>

            {/* Customer & Address Information */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Customer & Destination
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-100">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Name</div>
                  <div className="font-bold text-slate-900">
                    {typeof detailOrder.customerId === 'object'
                      ? detailOrder.customerId?.name || 'Customer'
                      : 'Customer'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Contact</div>
                  <div className="font-medium text-slate-700">
                    {typeof detailOrder.customerId === 'object'
                      ? detailOrder.customerId?.phone || detailOrder.customerId?.email || 'N/A'
                      : 'N/A'}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">
                    Fulfillment Method
                  </div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    {detailOrder.fulfillmentType === 'PICKUP' ? (
                      <>
                        <Store className="w-3.5 h-3.5 text-amber-600" />
                        <span>In-Store Customer Pickup (Requires Counter QR Verification)</span>
                      </>
                    ) : (
                      <>
                        <Truck className="w-3.5 h-3.5 text-sky-600" />
                        <span>
                          Local Delivery to {detailOrder.deliveryAddress?.street || ''},{' '}
                          {detailOrder.deliveryAddress?.city || ''}{' '}
                          {detailOrder.deliveryAddress?.pincode || ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Itemized Allocations */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Ordered Items & NearExpiry Allocations
              </div>
              <div className="space-y-2">
                {detailOrder.items?.map((item) => (
                  <div
                    key={item._id}
                    className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-black text-slate-900 text-xs">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Quantity: {item.requestedQuantity} {item.unit || 'pcs'} • Unit Price: ₹
                          {Number(item.blendedUnitPrice).toFixed(2)}
                        </div>
                      </div>
                      <div className="font-mono font-black text-slate-900 text-xs">
                        ₹{Number(item.lineDiscountedAmount).toFixed(2)}
                      </div>
                    </div>

                    {/* Batch Allocations Details if available */}
                    {item.batchAllocations && item.batchAllocations.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 space-y-1">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">
                          Allocated FEFO Batches
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {item.batchAllocations.map((alloc, aIdx) => (
                            <div
                              key={aIdx}
                              className="p-1.5 bg-white rounded-lg border border-slate-200 text-[10px] flex justify-between items-center"
                            >
                              <span className="font-mono font-bold text-slate-800">
                                #{alloc.batchNumber}
                              </span>
                              <span className="text-amber-700 font-semibold">
                                {alloc.allocatedQuantity} units ({alloc.remainingDays}d shelf)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono">
                  ₹{Number(detailOrder.pricingSummary?.subtotal || 0).toFixed(2)}
                </span>
              </div>
              {Number(detailOrder.pricingSummary?.discounts || 0) > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-medium">
                  <span>NearExpiry Dynamic Discounts:</span>
                  <span className="font-mono">
                    -₹{Number(detailOrder.pricingSummary?.discounts || 0).toFixed(2)}
                  </span>
                </div>
              )}
              {Number(detailOrder.pricingSummary?.deliveryFee || 0) > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>Delivery Fee:</span>
                  <span className="font-mono">
                    ₹{Number(detailOrder.pricingSummary.deliveryFee).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>Final Order Total:</span>
                <span className="font-mono text-base">
                  ₹{Number(detailOrder.pricingSummary?.finalTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Modal Action Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
              {detailOrder.status === 'DELIVERED' && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenReceipt(detailOrder._id);
                  }}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>View Bill Receipt</span>
                </button>
              )}

              {detailOrder.fulfillmentType === 'PICKUP' && detailOrder.status !== 'DELIVERED' && (
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenScanner(detailOrder);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan Pickup QR</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  setDetailOrder(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 10. QR Scanner & Verification Modal (100% PRESERVED FLOW) */}
      <Modal
        isOpen={scannerOpen}
        onClose={handleCloseScanner}
        title={verificationResult ? 'Pickup Verification Successful' : 'Scan Customer Pickup QR'}
        maxWidth="max-w-md"
      >
        {verificationResult ? (
          /* SUCCESS VIEW as requested by the user */
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="text-emerald-900 font-black text-lg">✓ Pickup Verified</div>
              <p className="text-xs text-emerald-700">Order handover confirmed atomically in MongoDB.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-600">Customer:</span>
                <span className="font-black text-slate-900 text-sm">
                  {verificationResult.order?.customer?.name || 'Customer'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-600">Order:</span>
                <span className="font-mono font-bold text-slate-900">
                  #{verificationResult.order?.orderNumber}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-600">Store:</span>
                <span className="font-semibold text-slate-900">
                  {verificationResult.order?.store?.storeName || 'Store'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-600">Items:</span>
                <span className="font-bold text-slate-900">
                  {verificationResult.order?.itemsCount || verificationResult.order?.items?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-600">Status:</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase text-[11px]">
                  {verificationResult.order?.status || 'Completed'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold text-slate-600">Verified at:</span>
                <span className="text-slate-900 font-mono text-[11px]">
                  {new Date(verificationResult.order?.verifiedAt || Date.now()).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (verificationResult?.order?._id) {
                    handleOpenReceipt(verificationResult.order._id);
                  }
                }}
                className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>View & Print Bill Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleCloseScanner}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow transition cursor-pointer"
              >
                Done & Return to Orders
              </button>
            </div>
          </div>
        ) : (
          /* SCANNER / INPUT VIEW */
          <div className="space-y-4">
            {selectedOrder && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex justify-between items-center">
                <span className="font-medium">Verifying Order:</span>
                <span className="font-mono font-bold">#{selectedOrder.orderNumber}</span>
              </div>
            )}

            {/* Mode Toggle: Camera vs Manual Paste */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setScanMode('camera')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  scanMode === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Camera Scanner</span>
              </button>
              <button
                type="button"
                onClick={() => setScanMode('manual')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  scanMode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Manual Token Paste</span>
              </button>
            </div>

            {scanError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}

            {verifying && (
              <div className="py-4">
                <LoadingSpinner text="Verifying pickup token with MongoDB source of truth..." />
              </div>
            )}

            {scanMode === 'camera' && !verifying && (
              <div className="space-y-2 text-center">
                <div
                  id="pickup-qr-reader"
                  className="overflow-hidden rounded-2xl border border-slate-200 mx-auto max-w-[320px]"
                />
                <p className="text-[11px] text-slate-500">
                  Point device camera at customer's Pickup QR screen
                </p>
              </div>
            )}

            {scanMode === 'manual' && !verifying && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paste Customer Verification Token
                  </label>
                  <textarea
                    rows={4}
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste secure pickup token from QR..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleVerifyToken(manualToken)}
                  disabled={!manualToken.trim()}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs shadow transition cursor-pointer"
                >
                  Verify Token
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 11. Itemized Bill Receipt Modal (100% PRESERVED) */}
      <BillReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={selectedReceipt}
      />
    </div>
  );
};

export default SellerOrdersPage;
