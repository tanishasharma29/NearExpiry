import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ShoppingBag,
  Store,
  User,
  Clock,
  Calendar,
  Layers,
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Package,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Copy,
  Check,
  FileText,
  DollarSign,
  Tag,
  ArrowUpDown,
  Truck,
  Sparkles,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminFilterBar,
  AdminDetailDrawer,
  AdminEmptyState,
  AdminMotionContainer,
} from '../../components/admin';

export const AdminOrdersPage = () => {
  // Master Orders & Stores Data
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');

  // Selected Order Dossier (Drawer)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch Platform Orders
  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [ordersRes, storesRes] = await Promise.allSettled([
        adminService.getOrders({ limit: 100 }),
        adminService.getStores({ limit: 100 }),
      ]);

      if (ordersRes.status === 'fulfilled') {
        const orderData = ordersRes.value;
        const list = Array.isArray(orderData)
          ? orderData
          : orderData?.orders || orderData?.data?.orders || [];
        setOrders(list);

        // Keep drawer in sync if open
        if (selectedOrder) {
          const updated = list.find((o) => o._id === selectedOrder._id);
          if (updated) setSelectedOrder(updated);
        }
      } else {
        throw ordersRes.reason || new Error('Failed to retrieve platform orders.');
      }

      if (storesRes.status === 'fulfilled') {
        const storeData = storesRes.value;
        const storeList = Array.isArray(storeData) ? storeData : storeData?.stores || [];
        setStores(storeList);
      }
    } catch (err) {
      console.error('Platform orders fetch error:', err);
      setError(err?.message || 'Failed to connect to platform orders service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Copy helper
  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Inspect Order Drawer
  const handleInspectOrder = (order) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  // Contextual Metrics
  const metrics = useMemo(() => {
    const total = orders.length;
    const inFlightStatuses = ['PLACED', 'CONFIRMED', 'PACKED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];
    const inFlight = orders.filter((o) => inFlightStatuses.includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === 'DELIVERED').length;
    const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
    const totalGrossValue = orders.reduce(
      (sum, o) => sum + (o.pricingSummary?.finalTotal || 0),
      0
    );

    // Counts by specific flow status
    const counts = {
      PLACED: orders.filter((o) => o.status === 'PLACED').length,
      CONFIRMED: orders.filter((o) => o.status === 'CONFIRMED').length,
      PACKED: orders.filter((o) => o.status === 'PACKED').length,
      READY_FOR_PICKUP: orders.filter((o) => o.status === 'READY_FOR_PICKUP').length,
      OUT_FOR_DELIVERY: orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
      DELIVERED: delivered,
      CANCELLED: cancelled,
    };

    return { total, inFlight, delivered, cancelled, totalGrossValue, counts };
  }, [orders]);

  // Filtered and Sorted Orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        // Status Filter
        if (statusFilter && order.status !== statusFilter) return false;

        // Payment Status Filter
        if (paymentStatusFilter && order.paymentStatus !== paymentStatusFilter) return false;

        // Store Filter
        if (storeFilter) {
          const storeId = order.storeId?._id || order.storeId;
          if (storeId !== storeFilter) return false;
        }

        // Search Filter (Order Number, Customer Name, Email, Store Name)
        if (search.trim()) {
          const query = search.trim().toLowerCase();
          const matchNumber = order.orderNumber?.toLowerCase().includes(query);
          const matchCustName = order.customerId?.name?.toLowerCase().includes(query);
          const matchCustEmail = order.customerId?.email?.toLowerCase().includes(query);
          const matchStore = order.storeId?.storeName?.toLowerCase().includes(query);
          if (!matchNumber && !matchCustName && !matchCustEmail && !matchStore) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date-desc':
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          case 'date-asc':
            return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
          case 'amount-desc':
            return (b.pricingSummary?.finalTotal || 0) - (a.pricingSummary?.finalTotal || 0);
          case 'amount-asc':
            return (a.pricingSummary?.finalTotal || 0) - (b.pricingSummary?.finalTotal || 0);
          case 'items-desc':
            return (b.pricingSummary?.itemCount || 0) - (a.pricingSummary?.itemCount || 0);
          default:
            return 0;
        }
      });
  }, [orders, search, statusFilter, paymentStatusFilter, storeFilter, sortBy]);

  // Clear filters
  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPaymentStatusFilter('');
    setStoreFilter('');
    setSortBy('date-desc');
  };

  const hasActiveFilters = Boolean(
    search || statusFilter || paymentStatusFilter || storeFilter || sortBy !== 'date-desc'
  );

  // Format Date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Command Header */}
      <AdminPageHeader
        eyebrow="PLATFORM OPERATIONS"
        title="Platform Orders Console"
        subtitle="Monitor marketplace transactions across customers, stores, fulfillment states, and order values from one centralized oversight console."
        breadcrumbs={[
          { label: 'Platform Command', href: '/admin' },
          { label: 'Platform Orders' },
        ]}
        statusBadge={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {metrics.total} Orders Logged
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              ₹{metrics.totalGrossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total Value
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchOrders(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
              title="Refresh order stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
              <span className="hidden sm:inline">Refresh Stream</span>
            </button>
          </div>
        }
      />

      {/* 2. Transaction Flow Signal Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                Marketplace Order Lifecycle Pipeline
              </h2>
              <p className="text-[11px] text-gray-500">
                Live distribution of marketplace orders across fulfillment stages
              </p>
            </div>
          </div>

          <div className="text-xs font-bold text-gray-600">
            In-Flight Active: <span className="text-purple-700 font-black">{metrics.inFlight}</span>
          </div>
        </div>

        {/* Pipeline Stage Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-blue-700 uppercase block">1. Placed</span>
            <span className="text-lg font-black text-blue-900">{metrics.counts.PLACED}</span>
          </div>

          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-blue-700 uppercase block">2. Confirmed</span>
            <span className="text-lg font-black text-blue-900">{metrics.counts.CONFIRMED}</span>
          </div>

          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">3. Packed</span>
            <span className="text-lg font-black text-amber-900">{metrics.counts.PACKED}</span>
          </div>

          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-amber-800 uppercase block">4. Ready Pickup</span>
            <span className="text-lg font-black text-amber-900">{metrics.counts.READY_FOR_PICKUP}</span>
          </div>

          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-blue-700 uppercase block">5. Out Delivery</span>
            <span className="text-lg font-black text-blue-900">{metrics.counts.OUT_FOR_DELIVERY}</span>
          </div>

          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">6. Delivered</span>
            <span className="text-lg font-black text-emerald-900">{metrics.counts.DELIVERED}</span>
          </div>

          <div className="bg-red-50/60 p-2.5 rounded-xl border border-red-100 text-center space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-red-700 uppercase block">Cancelled</span>
            <span className="text-lg font-black text-red-900">{metrics.counts.CANCELLED}</span>
          </div>
        </div>
      </div>

      {/* 3. Filter & Control Bar */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search orders by order number, customer name, email, or store..."
        filters={[
          {
            id: 'status',
            label: 'Order Status',
            value: statusFilter,
            onChange: setStatusFilter,
            icon: Filter,
            options: [
              { value: '', label: 'All Lifecycle Statuses' },
              { value: 'PLACED', label: 'Placed (Incoming)' },
              { value: 'CONFIRMED', label: 'Confirmed by Seller' },
              { value: 'PACKED', label: 'Packed' },
              { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
              { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
              { value: 'DELIVERED', label: 'Delivered / Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
          {
            id: 'payment',
            label: 'Payment Status',
            value: paymentStatusFilter,
            onChange: setPaymentStatusFilter,
            icon: CreditCard,
            options: [
              { value: '', label: 'All Payment States' },
              { value: 'PAID', label: 'Paid' },
              { value: 'PENDING', label: 'Payment Pending' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'REFUNDED', label: 'Refunded' },
            ],
          },
          {
            id: 'store',
            label: 'Store Filter',
            value: storeFilter,
            onChange: setStoreFilter,
            icon: Store,
            options: [
              { value: '', label: 'All Merchant Stores' },
              ...stores.map((s) => ({
                value: s._id,
                label: s.storeName,
              })),
            ],
          },
          {
            id: 'sort',
            label: 'Sort Ordering',
            value: sortBy,
            onChange: setSortBy,
            icon: ArrowUpDown,
            options: [
              { value: 'date-desc', label: 'Newest Orders First' },
              { value: 'date-asc', label: 'Oldest Orders First' },
              { value: 'amount-desc', label: 'Highest Final Total' },
              { value: 'amount-asc', label: 'Lowest Final Total' },
              { value: 'items-desc', label: 'Most Items Count' },
            ],
          },
        ]}
        totalResults={orders.length}
        filteredCount={filteredOrders.length}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
      />

      {/* 4. Platform Order Stream */}
      {loading ? (
        <div className="bg-white p-16 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <LoadingSpinner text="Retrieving platform transactions and marketplace order stream..." />
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-3xl border border-red-200 shadow-sm text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Platform Orders Error</h3>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchOrders(false)}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shadow"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <AdminEmptyState
          icon={ShoppingBag}
          title={hasActiveFilters ? 'No orders match criteria' : 'No platform orders recorded'}
          description={
            hasActiveFilters
              ? 'No orders match your active filter criteria, search string, or store selection.'
              : 'The marketplace has not recorded any transactions yet. Orders will stream here in real-time as customers check out.'
          }
          actionLabel={hasActiveFilters ? 'Reset Filters' : 'Refresh Feed'}
          actionIcon={hasActiveFilters ? RotateCcw : RefreshCw}
          onAction={hasActiveFilters ? handleClearFilters : () => fetchOrders(true)}
        />
      ) : (
        <div className="space-y-3.5">
          {filteredOrders.map((order) => {
            const itemCount = order.pricingSummary?.itemCount || order.items?.length || 0;
            const totalUnits = order.pricingSummary?.totalUnits || 0;
            const finalTotal = order.pricingSummary?.finalTotal || 0;
            const isAttention = order.status === 'CANCELLED' || order.paymentStatus === 'FAILED';

            return (
              <AdminMotionContainer
                key={order._id}
                hoverEffect
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition space-y-3.5 ${
                  isAttention
                    ? 'border-red-200/90 bg-red-50/10'
                    : order.status === 'PLACED'
                    ? 'border-purple-200 bg-purple-50/10'
                    : 'border-gray-200/90 hover:border-purple-300'
                }`}
              >
                {/* Order Top Banner */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left: Order ID & Timestamp */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200/80">
                      {order.orderNumber}
                    </span>
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {formatDate(order.createdAt)}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {order.fulfillmentType === 'PICKUP' ? 'Store Pickup' : 'Local Delivery'}
                    </span>
                  </div>

                  {/* Right: Dual Status Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <AdminStatusBadge status={order.paymentStatus} size="sm" label={`Pay: ${order.paymentStatus}`} />
                    <AdminStatusBadge status={order.status} size="sm" />
                  </div>
                </div>

                {/* Main Content Grid: Customer, Store, Item Preview, Financials */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1 text-xs">
                  {/* Customer Context */}
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" /> Customer
                    </span>
                    <div className="font-extrabold text-gray-900 truncate">
                      {order.customerId?.name || 'Customer Name'}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {order.customerId?.email || 'email@not-provided'}
                    </div>
                    {order.customerId?.phone && (
                      <div className="text-[10px] text-gray-400">
                        {order.customerId.phone}
                      </div>
                    )}
                  </div>

                  {/* Store Context */}
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Store className="w-3 h-3 text-gray-400" /> Merchant Store
                    </span>
                    <div className="font-extrabold text-purple-700 truncate">
                      {order.storeId?.storeName || 'Store Location'}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {order.storeId?.address?.city
                        ? `${order.storeId.address.city}, ${order.storeId.address.state || ''}`
                        : 'Store Fulfillment Point'}
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Package className="w-3 h-3 text-gray-400" /> Items &amp; Volume
                    </span>
                    <div className="font-bold text-gray-900">
                      {itemCount} SKU(s) • {totalUnits} unit(s)
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {order.items?.map((i) => i.productName).join(', ') || 'No item details'}
                    </div>
                  </div>

                  {/* Financial Total & Inspect */}
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-3 md:col-span-3 lg:col-span-1">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Final Total
                      </span>
                      <div className="text-base font-black text-gray-900">
                        ₹{Number(finalTotal).toFixed(2)}
                      </div>
                      {order.pricingSummary?.discounts > 0 && (
                        <div className="text-[10px] font-bold text-emerald-700">
                          Saved ₹{Number(order.pricingSummary.discounts).toFixed(2)}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInspectOrder(order)}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs transition shadow-sm hover:shadow"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              </AdminMotionContainer>
            );
          })}
        </div>
      )}

      {/* 5. Order Transaction Dossier (Slide-in Drawer) */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="TRANSACTION DOSSIER"
        title={selectedOrder?.orderNumber || 'Order Details'}
        subtitle={`System Document ID: ${selectedOrder?._id || 'N/A'}`}
        footerActions={
          selectedOrder && (
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-gray-500">
                Created: <strong className="text-gray-800">{formatDate(selectedOrder.createdAt)}</strong>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition shadow"
              >
                Close Dossier
              </button>
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6 text-xs">
            {/* Order Identity & Dual Status */}
            <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Transaction Record
                </span>
                <div className="flex items-center gap-2">
                  <AdminStatusBadge status={selectedOrder.paymentStatus} size="sm" label={`Pay: ${selectedOrder.paymentStatus}`} />
                  <AdminStatusBadge status={selectedOrder.status} size="sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Order Number</div>
                  <div className="font-mono text-purple-700 font-bold text-sm mt-0.5">{selectedOrder.orderNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Fulfillment Mode</div>
                  <div className="font-bold text-gray-900 text-xs mt-0.5">
                    {selectedOrder.fulfillmentType === 'PICKUP' ? 'Store Pickup' : 'Local Delivery'}
                  </div>
                </div>
              </div>

              {/* Mongo Document ID with copy button */}
              <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Database ObjectId</div>
                  <div className="font-mono text-gray-700 text-[11px] mt-0.5">{selectedOrder._id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyId(selectedOrder._id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Customer & Merchant Parties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Customer */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-purple-700" /> Customer Account
                </span>
                <div className="font-extrabold text-gray-900 text-sm">
                  {selectedOrder.customerId?.name || 'Customer Name'}
                </div>
                <div className="text-gray-500 text-[11px] space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-gray-400" />
                    <span>{selectedOrder.customerId?.email || 'N/A'}</span>
                  </div>
                  {selectedOrder.customerId?.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span>{selectedOrder.customerId.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Store */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-purple-700" /> Fulfilling Merchant
                </span>
                <div className="font-extrabold text-purple-700 text-sm">
                  {selectedOrder.storeId?.storeName || 'Store Location'}
                </div>
                <div className="text-gray-500 text-[11px] space-y-0.5">
                  {selectedOrder.storeId?.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="truncate">
                        {selectedOrder.storeId.address.street || ''}{' '}
                        {selectedOrder.storeId.address.city || ''}
                      </span>
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-gray-400">
                    Store ID: {selectedOrder.storeId?._id || selectedOrder.storeId || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items & Batch Allocation Context */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Order Line Items ({selectedOrder.items?.length || 0})
                </span>
                <span className="text-[11px] font-bold text-gray-500">
                  Total Units: {selectedOrder.pricingSummary?.totalUnits || 0}
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {selectedOrder.items?.map((item) => (
                  <div key={item._id} className="py-2.5 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900">{item.productName}</div>
                        <div className="text-[11px] text-gray-400">
                          {item.brand && `${item.brand} • `}Qty: {item.requestedQuantity} {item.unit || 'units'}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-gray-900">
                          ₹{Number(item.lineDiscountedAmount || 0).toFixed(2)}
                        </div>
                        {item.lineSavingsAmount > 0 && (
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            Saved ₹{Number(item.lineSavingsAmount).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Batch Allocations if exposed */}
                    {item.batchAllocations?.length > 0 && (
                      <div className="bg-gray-50 p-2 rounded-lg text-[10px] text-gray-500 space-y-0.5">
                        <span className="font-bold text-gray-600 block">FEFO Batch Allocations:</span>
                        {item.batchAllocations.map((alloc, idx) => (
                          <div key={idx} className="flex justify-between font-mono">
                            <span>Lot: {alloc.batchNumber} (Expires: {formatDate(alloc.expiryDate)})</span>
                            <span>{alloc.allocatedQuantity} unit(s) • -{alloc.discountPercent}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Financial Breakdown
              </span>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Gross Subtotal:</span>
                  <span>₹{Number(selectedOrder.pricingSummary?.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Dynamic Expiry Markdown:</span>
                  <span>-₹{Number(selectedOrder.pricingSummary?.discounts || 0).toFixed(2)}</span>
                </div>
                {selectedOrder.pricingSummary?.deliveryFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee:</span>
                    <span>₹{Number(selectedOrder.pricingSummary.deliveryFee).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-100 text-sm font-black text-gray-900">
                  <span>Authorized Final Total:</span>
                  <span className="text-purple-700">₹{Number(selectedOrder.pricingSummary?.finalTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 text-[11px] text-gray-500">
                  <span>Payment Method:</span>
                  <span className="font-semibold text-gray-800">{selectedOrder.paymentMethod || 'MOCK_PAYMENT'}</span>
                </div>
              </div>
            </div>

            {/* Delivery Address (if Delivery) */}
            {selectedOrder.fulfillmentType === 'LOCAL_DELIVERY' && selectedOrder.deliveryAddress && (
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2 text-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-700" /> Delivery Address
                </span>
                <div className="text-gray-800 font-medium leading-relaxed">
                  <div>Recipient: {selectedOrder.deliveryAddress.recipientName} ({selectedOrder.deliveryAddress.contactPhone})</div>
                  <div>{selectedOrder.deliveryAddress.street}</div>
                  <div>
                    {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state} - {selectedOrder.deliveryAddress.pincode}
                  </div>
                </div>
              </div>
            )}

            {/* Status Timeline / Audit Trail */}
            {selectedOrder.statusTimeline?.length > 0 && (
              <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200 space-y-2.5 text-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-700" /> Order Lifecycle Timeline
                </span>
                <div className="space-y-2">
                  {selectedOrder.statusTimeline.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px]">
                      <div className="w-2 h-2 rounded-full bg-purple-600 mt-1 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900">
                          {item.status}{' '}
                          <span className="font-normal text-gray-400">by {item.updatedByRole}</span>
                        </div>
                        <div className="text-gray-400 text-[10px]">
                          {formatDate(item.timestamp)} {item.note && `• ${item.note}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellation Details if Cancelled */}
            {selectedOrder.status === 'CANCELLED' && selectedOrder.cancellation && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1 text-xs">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>Cancellation Record</span>
                </div>
                <div className="text-[11px] text-red-800">
                  Reason: {selectedOrder.cancellation.reason || 'No reason specified'}
                </div>
                <div className="text-[10px] text-red-600">
                  Cancelled by: {selectedOrder.cancellation.cancelledByRole || 'User'} at {formatDate(selectedOrder.cancellation.cancelledAt)}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminDetailDrawer>
    </div>
  );
};

export default AdminOrdersPage;

