import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  History,
  FileText,
  Clock,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  RefreshCw,
  Search,
  Sliders,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Info,
  User,
  Store,
  Package,
  Calendar,
  ExternalLink,
  Database,
  Tag,
  TrendingDown,
  TrendingUp,
  Activity,
  Hash,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminFilterBar,
  AdminDetailDrawer,
  AdminEmptyState,
} from '../../components/admin';

/**
 * Human-friendly action labels and colors for Inventory Audit Actions
 */
const INVENTORY_ACTION_MAP = {
  INITIAL_STOCK: {
    label: 'Initial Stock Deposit',
    badge: 'ACTIVE',
    color: 'emerald',
    icon: Boxes,
    desc: 'Stock deposited during batch onboarding',
  },
  STOCK_ADJUSTMENT: {
    label: 'Manual Stock Adjustment',
    badge: 'WARNING',
    color: 'amber',
    icon: Sliders,
    desc: 'Manual adjustment performed by merchant or admin',
  },
  STOCK_RESERVATION: {
    label: 'Checkout Reservation',
    badge: 'PLACED',
    color: 'blue',
    icon: Clock,
    desc: 'Stock held during pending customer checkout',
  },
  STOCK_RELEASE: {
    label: 'Reservation Released',
    badge: 'NEUTRAL',
    color: 'gray',
    icon: RefreshCw,
    desc: 'Expired or cancelled order reservation restored',
  },
  STOCK_COMMITTED_SALE: {
    label: 'Committed Sale Deduction',
    badge: 'APPROVED',
    color: 'purple',
    icon: CheckCircle2,
    desc: 'Confirmed order payment deducted from inventory',
  },
  EXPIRED_WRITE_OFF: {
    label: 'Expired Stock Write-Off',
    badge: 'CRITICAL',
    color: 'rose',
    icon: AlertTriangle,
    desc: 'Batch expired and decommissioned from sale',
  },
};

/**
 * Human-friendly labels and colors for Price Change Triggers
 */
const PRICE_TRIGGER_MAP = {
  SCHEDULED_CRON_SWEEP: {
    label: 'Automated CRON Sweep',
    badge: 'ACTIVE',
    color: 'indigo',
    icon: Clock,
    desc: 'Scheduled automated dynamic markdown evaluation',
  },
  ADMIN_RULE_UPDATED: {
    label: 'Admin Rule Recalculation',
    badge: 'WARNING',
    color: 'amber',
    icon: Sliders,
    desc: 'Pricing rule modified triggering batch re-evaluation',
  },
  BATCH_CREATED: {
    label: 'Batch Onboarding Pricing',
    badge: 'PLACED',
    color: 'blue',
    icon: Boxes,
    desc: 'Initial pricing applied upon batch registration',
  },
  MANUAL_RECALCULATION: {
    label: 'Manual Operator Recalculation',
    badge: 'NEUTRAL',
    color: 'gray',
    icon: RefreshCw,
    desc: 'Manual batch repricing executed by platform operator',
  },
};

export const AdminAuditLogsPage = () => {
  // Active stream tab: 'inventory' | 'price'
  const [activeStream, setActiveStream] = useState('inventory');

  // Logs & Pagination state
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Available stores for filtering
  const [stores, setStores] = useState([]);

  // Client-side & query filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [triggerSourceFilter, setTriggerSourceFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Inspection Drawer
  const [selectedLog, setSelectedLog] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch stores list once for filter options
  useEffect(() => {
    let isMounted = true;
    adminService
      .getStores({ limit: 100 })
      .then((res) => {
        if (!isMounted) return;
        const storeData = res?.data?.stores || res?.stores || (Array.isArray(res) ? res : []);
        setStores(storeData);
      })
      .catch((err) => {
        console.warn('Could not load stores for audit filter dropdown:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Audit Logs when stream, page, or server-level filters change
  const fetchAuditLogs = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const queryParams = {
          logType: activeStream,
          page: currentPage,
          limit: 20,
        };

        if (activeStream === 'inventory' && actionTypeFilter) {
          queryParams.actionType = actionTypeFilter;
        }
        if (storeFilter) {
          queryParams.storeId = storeFilter;
        }

        const res = await adminService.getAuditLogs(queryParams);
        const data = res?.data || res;
        const fetchedLogs = Array.isArray(data?.logs) ? data.logs : [];
        const fetchedPagination = data?.pagination || {
          page: currentPage,
          limit: 20,
          total: fetchedLogs.length,
          totalPages: Math.ceil(fetchedLogs.length / 20) || 1,
        };

        setLogs(fetchedLogs);
        setPagination(fetchedPagination);

        // Keep inspected log in sync if drawer is open
        if (selectedLog) {
          const updated = fetchedLogs.find((l) => l._id === selectedLog._id);
          if (updated) setSelectedLog(updated);
        }
      } catch (err) {
        console.error('Audit logs fetch failed:', err);
        setError(err?.response?.data?.message || err?.message || 'Failed to retrieve audit log records.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeStream, currentPage, actionTypeFilter, storeFilter, selectedLog]
  );

  useEffect(() => {
    fetchAuditLogs();
  }, [activeStream, currentPage, actionTypeFilter, storeFilter]);

  // Reset page when switching streams
  const handleStreamChange = (newStream) => {
    if (newStream === activeStream) return;
    setActiveStream(newStream);
    setCurrentPage(1);
    setActionTypeFilter('');
    setTriggerSourceFilter('');
    setSearchTerm('');
  };

  // Copy ID helper
  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Inspect Drawer Handler
  const handleInspectLog = (log) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  // Filter & Sort client-side (search term + trigger source + sort order)
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Search filter across product, batch, actor, reason, rule, or store
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((l) => {
        const batchNum = l.batchNumber || l.batchId?.batchNumber || '';
        const prodName = l.productId?.name || '';
        const storeName = l.storeId?.storeName || '';
        const actorName = l.performedBy?.name || '';
        const actorEmail = l.performedBy?.email || '';
        const reason = l.reason || '';
        const refId = l.referenceId || '';
        const ruleName = l.appliedRuleName || '';
        const trigger = l.triggerSource || '';
        const action = l.actionType || '';

        return (
          batchNum.toLowerCase().includes(q) ||
          prodName.toLowerCase().includes(q) ||
          storeName.toLowerCase().includes(q) ||
          actorName.toLowerCase().includes(q) ||
          actorEmail.toLowerCase().includes(q) ||
          reason.toLowerCase().includes(q) ||
          refId.toLowerCase().includes(q) ||
          ruleName.toLowerCase().includes(q) ||
          trigger.toLowerCase().includes(q) ||
          action.toLowerCase().includes(q)
        );
      });
    }

    // Client-side triggerSource filter for price stream
    if (activeStream === 'price' && triggerSourceFilter) {
      result = result.filter((l) => l.triggerSource === triggerSourceFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'date-asc') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortBy === 'delta-desc') {
        const deltaA = activeStream === 'inventory' ? Math.abs(a.quantityChange || 0) : Math.abs(a.newFinalPrice - a.previousFinalPrice || 0);
        const deltaB = activeStream === 'inventory' ? Math.abs(b.quantityChange || 0) : Math.abs(b.newFinalPrice - b.previousFinalPrice || 0);
        return deltaB - deltaA;
      }
      // Default: date-desc (newest first)
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return result;
  }, [logs, searchTerm, triggerSourceFilter, activeStream, sortBy]);

  // Activity Stream Breakdown Counts
  const streamBreakdown = useMemo(() => {
    if (activeStream === 'inventory') {
      const counts = {
        STOCK_ADJUSTMENT: 0,
        STOCK_COMMITTED_SALE: 0,
        STOCK_RESERVATION: 0,
        STOCK_RELEASE: 0,
        INITIAL_STOCK: 0,
        EXPIRED_WRITE_OFF: 0,
      };
      logs.forEach((l) => {
        if (counts[l.actionType] !== undefined) {
          counts[l.actionType] += 1;
        }
      });
      return counts;
    } else {
      const counts = {
        SCHEDULED_CRON_SWEEP: 0,
        ADMIN_RULE_UPDATED: 0,
        BATCH_CREATED: 0,
        MANUAL_RECALCULATION: 0,
      };
      logs.forEach((l) => {
        if (counts[l.triggerSource] !== undefined) {
          counts[l.triggerSource] += 1;
        }
      });
      return counts;
    }
  }, [logs, activeStream]);

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setActionTypeFilter('');
    setTriggerSourceFilter('');
    setStoreFilter('');
    setSortBy('date-desc');
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    actionTypeFilter ||
    triggerSourceFilter ||
    storeFilter ||
    sortBy !== 'date-desc'
  );

  // Helper date formatting
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return String(dateStr);
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Command Header */}
      <AdminPageHeader
        eyebrow="SECURITY & ACCOUNTABILITY"
        title="Platform Audit Logs"
        subtitle="Trace administrative operations, batch stock movements, and dynamic pricing decisions across the marketplace with immutable audit trails."
        breadcrumbs={[
          { label: 'Platform Command', href: '/admin' },
          { label: 'Platform Audit Logs' },
        ]}
        statusBadge={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-100 shadow-sm">
              {pagination.total} Ledger Events
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Immutable Append-Only
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAuditLogs(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
              title="Refresh ledger stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
              <span className="hidden sm:inline">Refresh Ledger</span>
            </button>
          </div>
        }
      />

      {/* 2. Stream Selector & Activity Breakdown Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Stream Navigation Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Audit Stream Domain</h2>
              <p className="text-xs text-gray-500">Select the platform ledger stream to trace and inspect</p>
            </div>
          </div>

          <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => handleStreamChange('inventory')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeStream === 'inventory'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-purple-600" />
              <span>Inventory Movement Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => handleStreamChange('price')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeStream === 'price'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dynamic Pricing Audit Trail</span>
            </button>
          </div>
        </div>

        {/* Dynamic Activity Breakdown Chips */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
            Current Stream Signal Breakdown (Page {pagination.page} of {pagination.totalPages})
          </div>

          {activeStream === 'inventory' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                <span className="text-[10px] font-bold text-purple-700 block uppercase">Committed Sales</span>
                <span className="text-base font-bold text-purple-900">
                  {streamBreakdown.STOCK_COMMITTED_SALE}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-[10px] font-bold text-amber-700 block uppercase">Manual Adjustments</span>
                <span className="text-base font-bold text-amber-900">
                  {streamBreakdown.STOCK_ADJUSTMENT}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-[10px] font-bold text-blue-700 block uppercase">Reservations</span>
                <span className="text-base font-bold text-blue-900">
                  {streamBreakdown.STOCK_RESERVATION}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold text-gray-600 block uppercase">Releases</span>
                <span className="text-base font-bold text-gray-800">
                  {streamBreakdown.STOCK_RELEASE}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 block uppercase">Initial Deposits</span>
                <span className="text-base font-bold text-emerald-900">
                  {streamBreakdown.INITIAL_STOCK}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                <span className="text-[10px] font-bold text-rose-700 block uppercase">Expired Write-Offs</span>
                <span className="text-base font-bold text-rose-900">
                  {streamBreakdown.EXPIRED_WRITE_OFF}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-700 block uppercase">Automated CRON Sweeps</span>
                <span className="text-base font-bold text-indigo-900">
                  {streamBreakdown.SCHEDULED_CRON_SWEEP}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-[10px] font-bold text-amber-700 block uppercase">Rule Updates Triggered</span>
                <span className="text-base font-bold text-amber-900">
                  {streamBreakdown.ADMIN_RULE_UPDATED}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-[10px] font-bold text-blue-700 block uppercase">Onboarding Pricing</span>
                <span className="text-base font-bold text-blue-900">
                  {streamBreakdown.BATCH_CREATED}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold text-gray-600 block uppercase">Manual Recalculations</span>
                <span className="text-base font-bold text-gray-800">
                  {streamBreakdown.MANUAL_RECALCULATION}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Audit Control Bar */}
      <AdminFilterBar
        searchPlaceholder={
          activeStream === 'inventory'
            ? 'Search by batch number, product, store, actor, or reason...'
            : 'Search by batch number, product, store, rule name, or trigger...'
        }
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          ...(activeStream === 'inventory'
            ? [
                {
                  id: 'actionType',
                  label: 'Action Type',
                  value: actionTypeFilter,
                  onChange: (val) => {
                    setActionTypeFilter(val);
                    setCurrentPage(1);
                  },
                  icon: Sliders,
                  options: [
                    { value: '', label: 'All Inventory Actions' },
                    { value: 'STOCK_COMMITTED_SALE', label: 'Committed Sale' },
                    { value: 'STOCK_ADJUSTMENT', label: 'Manual Adjustment' },
                    { value: 'STOCK_RESERVATION', label: 'Checkout Reservation' },
                    { value: 'STOCK_RELEASE', label: 'Reservation Release' },
                    { value: 'INITIAL_STOCK', label: 'Initial Stock Deposit' },
                    { value: 'EXPIRED_WRITE_OFF', label: 'Expired Write-Off' },
                  ],
                },
              ]
            : [
                {
                  id: 'triggerSource',
                  label: 'Trigger Source',
                  value: triggerSourceFilter,
                  onChange: setTriggerSourceFilter,
                  icon: Sliders,
                  options: [
                    { value: '', label: 'All Price Triggers' },
                    { value: 'SCHEDULED_CRON_SWEEP', label: 'Scheduled CRON Sweep' },
                    { value: 'ADMIN_RULE_UPDATED', label: 'Admin Rule Updated' },
                    { value: 'BATCH_CREATED', label: 'Batch Created' },
                    { value: 'MANUAL_RECALCULATION', label: 'Manual Recalculation' },
                  ],
                },
              ]),
          {
            id: 'store',
            label: 'Merchant Store',
            value: storeFilter,
            onChange: (val) => {
              setStoreFilter(val);
              setCurrentPage(1);
            },
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
            icon: Clock,
            options: [
              { value: 'date-desc', label: 'Newest Events First' },
              { value: 'date-asc', label: 'Oldest Events First' },
              { value: 'delta-desc', label: 'Largest Mutation Delta' },
            ],
          },
        ]}
        totalResults={pagination.total}
        filteredCount={filteredLogs.length}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
      />

      {/* 4. Ledger Event Stream */}
      {loading ? (
        <div className="bg-white p-16 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="text-sm font-bold text-gray-900">Loading Immutable Audit Ledger...</h3>
          <p className="text-xs text-gray-500 mt-1">Retrieving tamper-evident event stream from backend store</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-900">Unable to load audit logs</p>
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchAuditLogs(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition self-start sm:self-auto shrink-0"
          >
            Retry Stream
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <AdminEmptyState
          icon={ShieldCheck}
          title={hasActiveFilters ? 'No Audit Events Matched Filters' : 'Audit Ledger is Empty'}
          description={
            hasActiveFilters
              ? 'Try widening your search terms or clearing specific action or store filters.'
              : `No ${activeStream === 'inventory' ? 'inventory movement' : 'dynamic pricing'} events have been recorded in this ledger stream yet.`
          }
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
              >
                Clear All Filters
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Vertical Chronological Ledger Feed */}
          <div className="relative pl-4 sm:pl-6 space-y-4 before:absolute before:top-3 before:bottom-3 before:left-2 sm:before:left-3 before:w-0.5 before:bg-gray-200">
            {filteredLogs.map((log) => {
              const isInventory = activeStream === 'inventory';
              const actionMeta = isInventory
                ? INVENTORY_ACTION_MAP[log.actionType] || {
                    label: log.actionType || 'Stock Event',
                    badge: 'NEUTRAL',
                    color: 'gray',
                    icon: Boxes,
                  }
                : PRICE_TRIGGER_MAP[log.triggerSource] || {
                    label: log.triggerSource || 'Pricing Event',
                    badge: 'NEUTRAL',
                    color: 'indigo',
                    icon: Sliders,
                  };

              const ActionIcon = actionMeta.icon;

              return (
                <div
                  key={log._id}
                  className="relative group bg-white rounded-2xl border border-gray-200/90 hover:border-purple-300 p-4 sm:p-5 shadow-sm transition hover:shadow-md"
                >
                  {/* Spine Node Marker */}
                  <div
                    className={`absolute -left-6 sm:-left-7 top-6 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                      actionMeta.color === 'emerald'
                        ? 'bg-emerald-500'
                        : actionMeta.color === 'purple'
                        ? 'bg-purple-600'
                        : actionMeta.color === 'amber'
                        ? 'bg-amber-500'
                        : actionMeta.color === 'rose'
                        ? 'bg-rose-500'
                        : actionMeta.color === 'blue'
                        ? 'bg-blue-500'
                        : 'bg-indigo-600'
                    }`}
                  />

                  {/* Card Content Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-100">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          actionMeta.color === 'emerald'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : actionMeta.color === 'purple'
                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                            : actionMeta.color === 'amber'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : actionMeta.color === 'rose'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : actionMeta.color === 'blue'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}
                      >
                        <ActionIcon className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-gray-900">{actionMeta.label}</span>
                          <AdminStatusBadge
                            status={actionMeta.badge}
                            label={isInventory ? log.actionType : log.triggerSource}
                            size="sm"
                          />
                          {log.referenceId && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              Ref: {log.referenceId}
                            </span>
                          )}
                        </div>

                        {/* Actor & Authorization context */}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                          {isInventory ? (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="font-semibold text-gray-700">
                                {log.performedBy?.name || 'Platform System'}
                              </span>
                              {log.performedBy?.email && (
                                <span className="text-gray-400 hidden md:inline">({log.performedBy.email})</span>
                              )}
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 uppercase">
                                {log.performedByRole || log.performedBy?.role || 'SYSTEM'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="font-semibold text-gray-700">
                                {log.triggerSource === 'SCHEDULED_CRON_SWEEP'
                                  ? 'Automated System Scheduler'
                                  : log.triggerSource === 'ADMIN_RULE_UPDATED'
                                  ? 'Pricing Engine Rule Hook'
                                  : 'Marketplace Automation Engine'}
                              </span>
                              {log.appliedRuleName && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Rule: {log.appliedRuleName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timestamp & Dossier Action */}
                    <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1.5 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-semibold text-gray-700 block">
                          {formatDateTime(log.createdAt)}
                        </span>
                        <span className="text-[11px] text-gray-400 block">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInspectLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                      >
                        <span>Inspect Dossier</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content Body: Resource Spec + Mutation Delta */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3">
                    {/* Resource Specification (Cols 1-7) */}
                    <div className="md:col-span-7 space-y-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {log.productId?.name || 'Unknown Product'}
                        </span>
                        {log.productId?.unit && (
                          <span className="text-[10px] text-gray-400">({log.productId.unit})</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 font-mono text-[11px]">
                          <Hash className="w-3 h-3 text-gray-400" />
                          <span>{log.batchNumber || log.batchId?.batchNumber || 'N/A'}</span>
                        </div>

                        <div className="flex items-center gap-1 text-gray-600">
                          <Store className="w-3 h-3 text-gray-400" />
                          <span>{log.storeId?.storeName || 'Merchant Store'}</span>
                        </div>

                        {log.remainingDays !== undefined && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              log.remainingDays <= 2
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : log.remainingDays <= 5
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {log.remainingDays} days to expiry
                          </span>
                        )}
                      </div>

                      {/* Reason / Trigger Rationale */}
                      {isInventory && log.reason && (
                        <div className="text-xs text-gray-600 bg-gray-50/80 rounded-lg p-2 border border-gray-100 italic">
                          <span className="not-italic font-semibold text-gray-500 mr-1">Reason:</span>
                          "{log.reason}"
                        </div>
                      )}
                    </div>

                    {/* Mutation Delta Visuals (Cols 8-12) */}
                    <div className="md:col-span-5 bg-gray-50/70 rounded-xl p-3 border border-gray-100 flex flex-col justify-center">
                      {isInventory ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Net Stock Delta:</span>
                            <span
                              className={`font-mono font-bold inline-flex items-center gap-0.5 ${
                                log.quantityChange > 0
                                  ? 'text-emerald-700'
                                  : log.quantityChange < 0
                                  ? 'text-rose-700'
                                  : 'text-gray-700'
                              }`}
                            >
                              {log.quantityChange > 0 ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : log.quantityChange < 0 ? (
                                <ArrowDown className="w-3 h-3" />
                              ) : null}
                              {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange} units
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-600 border-t border-gray-200/60 pt-1">
                            <span>Available Stock:</span>
                            <span className="font-mono">
                              {log.previousQuantity} → <strong className="text-gray-900">{log.newQuantity}</strong>
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-600">
                            <span>Reserved Units:</span>
                            <span className="font-mono">
                              {log.previousReserved || 0} →{' '}
                              <strong className="text-gray-900">{log.newReserved || 0}</strong>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Discount Shift:</span>
                            <span className="font-bold text-indigo-700 inline-flex items-center gap-1 font-mono">
                              {log.previousDiscountPercentage}% → <strong>{log.newDiscountPercentage}%</strong>
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs border-t border-gray-200/60 pt-1">
                            <span className="text-gray-500">Final Price:</span>
                            <span className="font-mono font-bold text-emerald-700">
                              ₹{log.previousFinalPrice?.toFixed(2)} → ₹{log.newFinalPrice?.toFixed(2)}
                            </span>
                          </div>

                          {log.originalPrice && (
                            <div className="flex items-center justify-between text-[10px] text-gray-400">
                              <span>Base MRP:</span>
                              <span className="font-mono">₹{log.originalPrice?.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Pagination Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-gray-600">
              Showing page <strong className="text-gray-900">{pagination.page}</strong> of{' '}
              <strong className="text-gray-900">{pagination.totalPages}</strong> (
              <strong className="text-gray-900">{pagination.total}</strong> total recorded events)
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="text-xs font-bold text-gray-700 px-2">
                {currentPage} / {pagination.totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage >= pagination.totalPages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Comprehensive Audit Event Dossier Drawer */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="AUDIT TRAIL RECORD"
        title={
          selectedLog
            ? activeStream === 'inventory'
              ? `${INVENTORY_ACTION_MAP[selectedLog.actionType]?.label || selectedLog.actionType}`
              : `${PRICE_TRIGGER_MAP[selectedLog.triggerSource]?.label || selectedLog.triggerSource}`
            : 'Event Inspection'
        }
        badge={
          selectedLog ? (
            <AdminStatusBadge
              status={
                activeStream === 'inventory'
                  ? INVENTORY_ACTION_MAP[selectedLog.actionType]?.badge || 'NEUTRAL'
                  : PRICE_TRIGGER_MAP[selectedLog.triggerSource]?.badge || 'ACTIVE'
              }
              label={activeStream === 'inventory' ? selectedLog.actionType : selectedLog.triggerSource}
            />
          ) : null
        }
      >
        {selectedLog && (
          <div className="space-y-6">
            {/* Record Identity & Monospace ID */}
            <div className="p-4 bg-slate-900 rounded-2xl text-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Ledger Record Identifier
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyId(selectedLog._id)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-white transition"
                  title="Copy Record ID"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-slate-200 break-all select-all">{selectedLog._id}</div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  Collection: <code>{activeStream === 'inventory' ? 'inventoryAudits' : 'priceAuditLogs'}</code>
                </span>
              </div>
            </div>

            {/* Section A: Event Identification & Timestamp */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <Clock className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Event Chronology & Execution
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500 block text-[11px]">Recorded Timestamp (Local)</span>
                  <span className="font-semibold text-gray-900 block mt-0.5">
                    {formatDateTime(selectedLog.createdAt)}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500 block text-[11px]">ISO 8601 Timestamp</span>
                  <span className="font-mono text-[11px] text-gray-900 block mt-0.5 break-all">
                    {selectedLog.createdAt || 'N/A'}
                  </span>
                </div>
              </div>

              {selectedLog.referenceId && (
                <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-purple-700 font-semibold">External Reference ID:</span>
                  <span className="font-mono font-bold text-purple-900">{selectedLog.referenceId}</span>
                </div>
              )}
            </div>

            {/* Section B: Actor & Authorization Context */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <User className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Actor & Authorization Context
                </h3>
              </div>

              {activeStream === 'inventory' ? (
                <div className="p-3 bg-gray-50 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Initiator Name:</span>
                    <span className="font-bold text-gray-900">
                      {selectedLog.performedBy?.name || 'Platform System'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Initiator Email:</span>
                    <span className="font-mono text-gray-700">
                      {selectedLog.performedBy?.email || 'automated-system@nearexpiry.internal'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Authorization Role:</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 uppercase">
                      {selectedLog.performedByRole || selectedLog.performedBy?.role || 'SYSTEM'}
                    </span>
                  </div>
                  {selectedLog.performedBy?._id && (
                    <div className="flex justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60">
                      <span>User ObjectId:</span>
                      <span className="font-mono">{selectedLog.performedBy._id}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-indigo-700 font-semibold">Trigger Mechanism:</span>
                    <span className="font-bold text-indigo-900">{selectedLog.triggerSource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-700">Applied Rule Name:</span>
                    <span className="font-semibold text-indigo-900">
                      {selectedLog.appliedRuleName || 'Default Platform Markdown'}
                    </span>
                  </div>
                  {selectedLog.appliedRuleId && (
                    <div className="flex justify-between text-[11px] text-indigo-600 pt-1 border-t border-indigo-200/50">
                      <span>Price Rule ObjectId:</span>
                      <span className="font-mono">{selectedLog.appliedRuleId}</span>
                    </div>
                  )}
                  {selectedLog.triggeredBy && (
                    <div className="flex justify-between text-[11px] text-indigo-600">
                      <span>Triggered by User ID:</span>
                      <span className="font-mono">{selectedLog.triggeredBy}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section C: Affected Marketplace Resource */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <Boxes className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Target Marketplace Resource
                </h3>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Product Title:</span>
                  <span className="font-bold text-gray-900">
                    {selectedLog.productId?.name || 'Unknown Product'}
                  </span>
                </div>
                {selectedLog.productId?.unit && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Package Unit:</span>
                    <span className="font-semibold text-gray-800">{selectedLog.productId.unit}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Batch Code:</span>
                  <span className="font-mono font-bold text-gray-900 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                    {selectedLog.batchNumber || selectedLog.batchId?.batchNumber || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Merchant Store:</span>
                  <span className="font-semibold text-gray-800">
                    {selectedLog.storeId?.storeName || 'Merchant Store'}
                  </span>
                </div>
                {selectedLog.batchId?.expiryDate && (
                  <div className="flex justify-between text-[11px] pt-1 border-t border-gray-200/60">
                    <span className="text-gray-500">Expiry Date:</span>
                    <span className="font-mono text-gray-800">
                      {formatDateTime(selectedLog.batchId.expiryDate)}
                    </span>
                  </div>
                )}
                {selectedLog.remainingDays !== undefined && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500">Days to Expiry at Audit:</span>
                    <span className="font-bold text-gray-900">{selectedLog.remainingDays} days</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section D: State Mutation Diff */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <Sliders className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  State Mutation Diff
                </h3>
              </div>

              {activeStream === 'inventory' ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                  <div className="grid grid-cols-3 bg-gray-100 p-2 font-bold text-gray-700 text-center text-[11px]">
                    <div>Parameter</div>
                    <div>Pre-Audit State</div>
                    <div>Post-Audit State</div>
                  </div>
                  <div className="divide-y divide-gray-100 bg-white">
                    <div className="grid grid-cols-3 p-2.5 items-center text-center">
                      <span className="text-left font-semibold text-gray-600">Available Qty</span>
                      <span className="font-mono text-gray-500">{selectedLog.previousQuantity}</span>
                      <span className="font-mono font-bold text-gray-900">{selectedLog.newQuantity}</span>
                    </div>
                    <div className="grid grid-cols-3 p-2.5 items-center text-center">
                      <span className="text-left font-semibold text-gray-600">Reserved Units</span>
                      <span className="font-mono text-gray-500">{selectedLog.previousReserved || 0}</span>
                      <span className="font-mono font-bold text-gray-900">{selectedLog.newReserved || 0}</span>
                    </div>
                    <div className="grid grid-cols-3 p-2.5 items-center text-center bg-purple-50/40">
                      <span className="text-left font-semibold text-purple-800">Net Delta</span>
                      <span className="text-gray-400">—</span>
                      <span
                        className={`font-mono font-bold ${
                          selectedLog.quantityChange > 0
                            ? 'text-emerald-700'
                            : selectedLog.quantityChange < 0
                            ? 'text-rose-700'
                            : 'text-gray-700'
                        }`}
                      >
                        {selectedLog.quantityChange > 0
                          ? `+${selectedLog.quantityChange}`
                          : selectedLog.quantityChange}{' '}
                        units
                      </span>
                    </div>
                    {selectedLog.batchStatusAfter && (
                      <div className="grid grid-cols-3 p-2.5 items-center text-center">
                        <span className="text-left font-semibold text-gray-600">Batch Status</span>
                        <span className="text-gray-400">—</span>
                        <span>
                          <AdminStatusBadge status={selectedLog.batchStatusAfter} size="sm" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                  <div className="grid grid-cols-3 bg-gray-100 p-2 font-bold text-gray-700 text-center text-[11px]">
                    <div>Parameter</div>
                    <div>Previous</div>
                    <div>Calculated New</div>
                  </div>
                  <div className="divide-y divide-gray-100 bg-white">
                    <div className="grid grid-cols-3 p-2.5 items-center text-center">
                      <span className="text-left font-semibold text-gray-600">Discount %</span>
                      <span className="font-mono text-gray-500">{selectedLog.previousDiscountPercentage}%</span>
                      <span className="font-mono font-bold text-indigo-700">
                        {selectedLog.newDiscountPercentage}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 p-2.5 items-center text-center">
                      <span className="text-left font-semibold text-gray-600">Final Price</span>
                      <span className="font-mono text-gray-500">
                        ₹{selectedLog.previousFinalPrice?.toFixed(2)}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        ₹{selectedLog.newFinalPrice?.toFixed(2)}
                      </span>
                    </div>
                    {selectedLog.originalPrice && (
                      <div className="grid grid-cols-3 p-2.5 items-center text-center bg-gray-50">
                        <span className="text-left font-semibold text-gray-600">Original Base MRP</span>
                        <span className="font-mono text-gray-700 col-span-2 text-right pr-4">
                          ₹{selectedLog.originalPrice?.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {selectedLog.batchStatus && (
                      <div className="grid grid-cols-3 p-2.5 items-center text-center">
                        <span className="text-left font-semibold text-gray-600">Batch Lifecycle</span>
                        <span className="text-gray-400">—</span>
                        <span>
                          <AdminStatusBadge status={selectedLog.batchStatus} size="sm" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section E: Operational Rationale */}
            {activeStream === 'inventory' && selectedLog.reason && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                  <Info className="w-4 h-4 text-purple-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Operational Rationale
                  </h3>
                </div>
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                  "{selectedLog.reason}"
                </div>
              </div>
            )}

            {/* Immutable Ledger Notice */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-gray-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Tamper-Resistant Platform Ledger</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This record is strictly append-only. Platform policy prohibits modification or deletion of
                historical audit traces to ensure full marketplace regulatory accountability.
              </p>
            </div>
          </div>
        )}
      </AdminDetailDrawer>
    </div>
  );
};

export default AdminAuditLogsPage;

