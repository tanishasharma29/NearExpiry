import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Boxes,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Flame,
  Clock,
  RefreshCw,
  Eye,
  Search,
  Filter,
  RotateCcw,
  Building2,
  Store,
  Package,
  Layers,
  Tag,
  ArrowUpDown,
  ChevronRight,
  X,
  Calendar,
  Info,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminFilterBar,
  AdminDetailDrawer,
  AdminEmptyState,
  AdminRiskIndicator,
  AdminMotionContainer,
} from '../../components/admin';

export const AdminInventoryPage = () => {
  // Master Inventory & Monitoring Data
  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expiryData, setExpiryData] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filtering
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [sortBy, setSortBy] = useState('urgency-asc');
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'store-exposure'

  // Selected Batch Inspection Dossier (Drawer)
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch Inventory Monitoring Data
  const fetchInventoryData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [inventoryRes, expiryRes, storesRes] = await Promise.allSettled([
        adminService.getInventoryMonitoring({ limit: 100 }),
        adminService.getExpiryMonitoring(),
        adminService.getStores({ limit: 100 }),
      ]);

      if (inventoryRes.status === 'fulfilled') {
        const data = inventoryRes.value;
        const batchList = data?.batches || data?.inventory || [];
        setBatches(batchList);
        setSummary(data?.summary || null);

        // Keep drawer in sync
        if (selectedBatch) {
          const updated = batchList.find((b) => b._id === selectedBatch._id);
          if (updated) setSelectedBatch(updated);
        }
      } else {
        throw inventoryRes.reason || new Error('Failed to retrieve inventory monitoring data.');
      }

      if (expiryRes.status === 'fulfilled') {
        setExpiryData(expiryRes.value);
      }

      if (storesRes.status === 'fulfilled') {
        const storeData = storesRes.value;
        const storeList = Array.isArray(storeData) ? storeData : storeData?.stores || [];
        setStores(storeList);
      }
    } catch (err) {
      console.error('Inventory Radar fetch error:', err);
      setError(err?.message || 'Failed to connect to Global Inventory Radar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBatch]);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  // Copy helper
  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Inspect Batch Drawer
  const handleInspectBatch = (batch) => {
    setSelectedBatch(batch);
    setDrawerOpen(true);
  };

  // Risk Classification Mapper based on authoritative remainingDays and batch status
  const getBatchRiskLevel = (batch) => {
    if (!batch) return 'LOW';
    if (batch.status === 'EXPIRED' || batch.remainingDays < 0) return 'CRITICAL';
    if (batch.status === 'CRITICAL' || batch.remainingDays <= 7) return 'CRITICAL';
    if (batch.status === 'APPROACHING_EXPIRY' || (batch.remainingDays > 7 && batch.remainingDays <= 30)) return 'HIGH';
    if (batch.status === 'OUT_OF_STOCK' || batch.quantity <= 0) return 'MODERATE';
    return 'LOW';
  };

  // Filtered and Sorted Batches
  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => {
        const riskLevel = getBatchRiskLevel(b);

        // Severity / Risk Filter
        if (severityFilter) {
          if (severityFilter === 'CRITICAL' && riskLevel !== 'CRITICAL') return false;
          if (severityFilter === 'HIGH' && riskLevel !== 'HIGH') return false;
          if (severityFilter === 'LOW' && riskLevel !== 'LOW') return false;
          if (severityFilter === 'EXPIRED' && b.status !== 'EXPIRED' && b.remainingDays >= 0) return false;
        }

        // Store Filter
        if (storeFilter) {
          const storeId = b.storeId?._id || b.storeId;
          if (storeId !== storeFilter) return false;
        }

        // Search Filter (by Product Name, Brand, Batch Number, Store Name)
        if (search.trim()) {
          const query = search.trim().toLowerCase();
          const matchProduct = b.productId?.name?.toLowerCase().includes(query);
          const matchBrand = b.productId?.brand?.toLowerCase().includes(query);
          const matchBatch = b.batchNumber?.toLowerCase().includes(query);
          const matchStore = b.storeId?.storeName?.toLowerCase().includes(query);
          if (!matchProduct && !matchBrand && !matchBatch && !matchStore) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'urgency-asc':
            return (a.remainingDays ?? 999) - (b.remainingDays ?? 999);
          case 'quantity-desc':
            return (b.quantity || 0) - (a.quantity || 0);
          case 'value-desc':
            return ((b.quantity || 0) * (b.currentPrice || 0)) - ((a.quantity || 0) * (a.currentPrice || 0));
          case 'product-asc':
            return (a.productId?.name || '').localeCompare(b.productId?.name || '');
          default:
            return 0;
        }
      });
  }, [batches, search, severityFilter, storeFilter, sortBy]);

  // Store Exposure Aggregation derived truthfully from active batches
  const storeExposureList = useMemo(() => {
    const storeMap = new Map();

    for (const b of batches) {
      const storeId = b.storeId?._id || b.storeId || 'unknown';
      const storeName = b.storeId?.storeName || 'Store';

      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, {
          storeId,
          storeName,
          totalLots: 0,
          totalUnits: 0,
          criticalLots: 0,
          approachingLots: 0,
          expiredLots: 0,
          currentValuation: 0,
        });
      }

      const entry = storeMap.get(storeId);
      entry.totalLots += 1;
      entry.totalUnits += (b.quantity || 0);
      entry.currentValuation += ((b.quantity || 0) * (b.currentPrice || 0));

      const risk = getBatchRiskLevel(b);
      if (risk === 'CRITICAL') entry.criticalLots += 1;
      if (risk === 'HIGH') entry.approachingLots += 1;
      if (b.status === 'EXPIRED' || b.remainingDays < 0) entry.expiredLots += 1;
    }

    return Array.from(storeMap.values()).sort((a, b) => b.criticalLots - a.criticalLots || b.totalUnits - a.totalUnits);
  }, [batches]);

  // Clear filters
  const handleClearFilters = () => {
    setSearch('');
    setSeverityFilter('');
    setStoreFilter('');
    setSortBy('urgency-asc');
  };

  const hasActiveFilters = Boolean(search || severityFilter || storeFilter || sortBy !== 'urgency-asc');

  // Format Date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Global Radar Command Header */}
      <AdminPageHeader
        eyebrow="PLATFORM OPERATIONS"
        title="Global Inventory Radar"
        subtitle="Monitor marketplace-wide inventory exposure, expiry risk, and high-priority stock across every participating store."
        breadcrumbs={[
          { label: 'Platform Command', href: '/admin' },
          { label: 'Inventory Radar' },
        ]}
        statusBadge={
          summary && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {summary.totalLots} Batches Tracked
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {summary.totalUnits.toLocaleString()} Physical Units
              </span>
            </div>
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchInventoryData(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
              title="Refresh inventory scan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
              <span className="hidden sm:inline">Refresh Scan</span>
            </button>
          </div>
        }
      />

      {/* 2. Platform Exposure Signal Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900 text-sm tracking-tight">
                  Marketplace Expiry Exposure Radar
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Platform Telemetry
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Centralized detection across all active seller storefronts. Identifies critical shelf-life velocity, expired locks, and financial inventory exposure.
              </p>
            </div>
          </div>

          {summary && (
            <div className="flex items-center gap-3 text-right flex-shrink-0">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  Active Platform Valuation
                </span>
                <span className="text-base font-black text-gray-900">
                  ₹{Number(summary.totalCurrentValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-gray-400 block line-through">
                  Base: ₹{Number(summary.totalOriginalValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. Risk Radar / Distribution Spectrum (Severity Lanes) */}
        {expiryData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-gray-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-red-600" /> Shelf-Life Severity Distribution
              </span>
              <span className="text-[11px] text-gray-400">
                {expiryData.activeUnacknowledgedAlerts} Unacknowledged Operational Alert(s)
              </span>
            </div>

            {/* Severity Distribution Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Critical Risk */}
              <div className="p-3 rounded-xl bg-red-50/70 border border-red-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider">
                    Critical Risk (&le; 7 Days)
                  </span>
                  <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                </div>
                <div className="text-xl font-black text-red-700">
                  {expiryData.criticalLots?.unitCount || 0}{' '}
                  <span className="text-xs font-semibold text-red-800">units</span>
                </div>
                <div className="text-[10px] text-red-800 font-medium">
                  {expiryData.criticalLots?.lotCount || 0} batches requiring immediate rescue
                </div>
              </div>

              {/* Approaching Expiry */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Approaching Expiry (8–30 Days)
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-xl font-black text-amber-700">
                  {expiryData.approachingLots?.unitCount || 0}{' '}
                  <span className="text-xs font-semibold text-amber-800">units</span>
                </div>
                <div className="text-[10px] text-amber-800 font-medium">
                  {expiryData.approachingLots?.lotCount || 0} batches under dynamic markdown
                </div>
              </div>

              {/* Expired / Locked */}
              <div className="p-3 rounded-xl bg-gray-100/90 border border-gray-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                    Expired / Locked (&lt; 0 Days)
                  </span>
                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <div className="text-xl font-black text-gray-800">
                  {expiryData.expiredLots?.unitCount || 0}{' '}
                  <span className="text-xs font-semibold text-gray-600">units</span>
                </div>
                <div className="text-[10px] text-gray-500 font-medium">
                  {expiryData.expiredLots?.lotCount || 0} batches locked from purchasing
                </div>
              </div>

              {/* Low Stock Warning */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                    Low Stock Batches (&le; 5 Units)
                  </span>
                  <Boxes className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-xl font-black text-blue-700">
                  {summary?.lowStockLots || 0}{' '}
                  <span className="text-xs font-semibold text-blue-800">lots</span>
                </div>
                <div className="text-[10px] text-blue-800 font-medium">
                  {summary?.outOfStockLots || 0} batches completely depleted
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Filter & Control Bar */}
      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search inventory by product, brand, batch number, or store name..."
        filters={[
          {
            id: 'severity',
            label: 'Risk Severity',
            value: severityFilter,
            onChange: setSeverityFilter,
            icon: Filter,
            options: [
              { value: '', label: 'All Severity Levels' },
              { value: 'CRITICAL', label: 'Critical Risk (≤ 7 Days)' },
              { value: 'HIGH', label: 'Approaching Expiry (8–30 Days)' },
              { value: 'LOW', label: 'Standard Shelf Life (> 30 Days)' },
              { value: 'EXPIRED', label: 'Expired / Locked (< 0 Days)' },
            ],
          },
          {
            id: 'store',
            label: 'Store Filter',
            value: storeFilter,
            onChange: setStoreFilter,
            icon: Store,
            options: [
              { value: '', label: 'All Marketplace Stores' },
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
              { value: 'urgency-asc', label: 'Most Urgent Expiry First' },
              { value: 'quantity-desc', label: 'Highest Quantity at Risk' },
              { value: 'value-desc', label: 'Highest Financial Valuation' },
              { value: 'product-asc', label: 'Product Title (A to Z)' },
            ],
          },
        ]}
        totalResults={batches.length}
        filteredCount={filteredBatches.length}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
        extraActions={
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'queue'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Risk Queue ({filteredBatches.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('store-exposure')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'store-exposure'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Store Exposure ({storeExposureList.length})
            </button>
          </div>
        }
      />

      {/* 5. Main Workspace: High-Risk Queue OR Store Exposure */}
      {loading ? (
        <div className="bg-white p-16 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <LoadingSpinner text="Scanning marketplace inventory and calculating cross-store shelf-life risk..." />
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-3xl border border-red-200 shadow-sm text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Inventory Radar Connection Error</h3>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchInventoryData(false)}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shadow"
          >
            Retry Radar Scan
          </button>
        </div>
      ) : activeTab === 'queue' ? (
        /* View 1: High-Risk Inventory Queue */
        filteredBatches.length === 0 ? (
          <AdminEmptyState
            icon={Boxes}
            title={hasActiveFilters ? 'No inventory matches criteria' : 'No active inventory batches'}
            description={
              hasActiveFilters
                ? 'No batches match your active risk severity, store selection, or search query.'
                : 'No inventory batches were found in the marketplace. Stores have not yet uploaded stock.'
            }
            actionLabel={hasActiveFilters ? 'Reset Filters' : 'Refresh Telemetry'}
            actionIcon={hasActiveFilters ? RotateCcw : RefreshCw}
            onAction={hasActiveFilters ? handleClearFilters : () => fetchInventoryData(true)}
          />
        ) : (
          <div className="space-y-3">
            {filteredBatches.map((batch) => {
              const riskLevel = getBatchRiskLevel(batch);
              const isExpired = batch.status === 'EXPIRED' || batch.remainingDays < 0;

              return (
                <AdminMotionContainer
                  key={batch._id}
                  hoverEffect
                  className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition space-y-3 ${
                    riskLevel === 'CRITICAL'
                      ? 'border-red-200/90 hover:border-red-300 bg-red-50/10'
                      : riskLevel === 'HIGH'
                      ? 'border-amber-200/90 hover:border-amber-300 bg-amber-50/10'
                      : 'border-gray-200/90 hover:border-purple-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Product & Store Context */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                          riskLevel === 'CRITICAL'
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : riskLevel === 'HIGH'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : 'bg-purple-50 text-purple-700 border-purple-100'
                        }`}
                      >
                        <Package className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-gray-900 text-sm tracking-tight truncate">
                            {batch.productId?.name || 'Catalog Item'}
                          </h4>
                          {batch.productId?.brand && (
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {batch.productId.brand}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                            Lot: {batch.batchNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold text-gray-700">
                            <Store className="w-3.5 h-3.5 text-gray-400" />
                            {batch.storeId?.storeName || 'Store Location'}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span>Expires: <strong className="text-gray-800">{formatDate(batch.expiryDate)}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Risk Badge, Units, Dynamic Price & Actions */}
                    <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap justify-between lg:justify-end">
                      {/* Expiry Countdown */}
                      <div className="text-left lg:text-right">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Remaining Shelf Life
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <AdminRiskIndicator
                            level={riskLevel}
                            variant="compact"
                            label={
                              isExpired
                                ? 'Expired'
                                : batch.remainingDays === 0
                                ? 'Expires Today'
                                : `${batch.remainingDays} Days Left`
                            }
                          />
                        </div>
                      </div>

                      {/* Stock Quantity */}
                      <div className="text-left lg:text-right min-w-[70px]">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Stock
                        </span>
                        <span className="text-sm font-extrabold text-gray-900">
                          {batch.quantity}{' '}
                          <span className="text-[10px] font-normal text-gray-400">
                            {batch.productId?.unit || 'units'}
                          </span>
                        </span>
                      </div>

                      {/* Dynamic Valuation */}
                      <div className="text-left lg:text-right min-w-[90px]">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Price
                        </span>
                        <div className="flex items-baseline gap-1 lg:justify-end">
                          <span className="text-sm font-black text-gray-900">
                            ₹{Number(batch.currentPrice || 0).toFixed(2)}
                          </span>
                          {batch.discountPercentage > 0 && (
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded">
                              -{batch.discountPercentage}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inspect Dossier Action */}
                      <button
                        type="button"
                        onClick={() => handleInspectBatch(batch)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 transition flex-shrink-0"
                        title="Inspect inventory batch dossier"
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
        )
      ) : (
        /* View 2: Store Exposure Aggregation View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Stores ranked by critical lots count and volume at risk. Click "Filter Store" to inspect a specific merchant.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storeExposureList.map((store) => (
              <AdminMotionContainer
                key={store.storeId}
                hoverEffect
                className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 flex-shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">
                          {store.storeName}
                        </h4>
                        <div className="text-[10px] text-gray-400 font-mono">
                          ID: {store.storeId}
                        </div>
                      </div>
                    </div>

                    {store.criticalLots > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200">
                        <Flame className="w-3 h-3 text-red-600" />
                        {store.criticalLots} Critical
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Stable
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Batches</span>
                      <span className="text-sm font-extrabold text-gray-900">{store.totalLots}</span>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Stock Units</span>
                      <span className="text-sm font-extrabold text-gray-900">{store.totalUnits}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                    <span className="text-gray-500 font-medium">Inventory Valuation:</span>
                    <span className="font-bold text-gray-900">
                      ₹{Number(store.currentValuation).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStoreFilter(store.storeId);
                      setActiveTab('queue');
                    }}
                    className="w-full py-2 bg-gray-50 hover:bg-purple-50 text-purple-700 border border-gray-200 hover:border-purple-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <span>Filter Batches for this Store</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </AdminMotionContainer>
            ))}
          </div>
        </div>
      )}

      {/* 6. Inventory Risk Dossier (Slide-in Drawer) */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="INVENTORY RISK DOSSIER"
        title={selectedBatch?.productId?.name || 'Batch Details'}
        subtitle={`Lot Identifier: ${selectedBatch?.batchNumber || 'N/A'}`}
        footerActions={
          selectedBatch && (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  setStoreFilter(selectedBatch.storeId?._id || selectedBatch.storeId);
                  setDrawerOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded-xl transition border border-purple-200"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Filter by {selectedBatch.storeId?.storeName || 'Store'}</span>
              </button>

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
        {selectedBatch && (
          <div className="space-y-6 text-xs">
            {/* Shelf-Life & Risk State Card */}
            <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Risk &amp; Expiry Classification
                </span>
                <AdminRiskIndicator
                  level={getBatchRiskLevel(selectedBatch)}
                  variant="badge"
                  label={getBatchRiskLevel(selectedBatch)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Days Remaining</div>
                  <div className="font-black text-gray-900 text-base mt-0.5">
                    {selectedBatch.remainingDays < 0
                      ? 'Expired (< 0)'
                      : `${selectedBatch.remainingDays} Days`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Expiry Date</div>
                  <div className="font-bold text-gray-800 text-sm mt-0.5">
                    {formatDate(selectedBatch.expiryDate)}
                  </div>
                </div>
              </div>

              {/* Batch Document ID */}
              <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase">Batch ObjectId</div>
                  <div className="font-mono text-gray-700 text-[11px] mt-0.5">{selectedBatch._id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyId(selectedBatch._id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Product & Store Specification */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Catalog &amp; Merchant Identity
              </span>

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Product Name:</span>
                  <span className="font-bold text-gray-900">{selectedBatch.productId?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Brand / Unit:</span>
                  <span className="font-semibold text-gray-800">
                    {selectedBatch.productId?.brand || 'Standard'} • {selectedBatch.productId?.unit || 'Item'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Store Name:</span>
                  <span className="font-bold text-purple-700">{selectedBatch.storeId?.storeName || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Purchasable Online:</span>
                  <span className={`font-bold ${selectedBatch.isPurchasable ? 'text-emerald-700' : 'text-red-700'}`}>
                    {selectedBatch.isPurchasable ? 'Active on Customer Storefront' : 'Locked from Checkout'}
                  </span>
                </div>
              </div>
            </div>

            {/* Inventory Stock Breakdown */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Volume &amp; Movement Breakdown
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Sellable</span>
                  <span className="text-base font-extrabold text-gray-900">{selectedBatch.quantity}</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Reserved</span>
                  <span className="text-base font-extrabold text-gray-700">{selectedBatch.reservedQuantity || 0}</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Sold</span>
                  <span className="text-base font-extrabold text-emerald-700">{selectedBatch.soldQuantity || 0}</span>
                </div>
              </div>
            </div>

            {/* Dynamic Valuation & Price Details */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Valuation &amp; FEFO Markdown Context
              </span>

              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Current Unit Price:</span>
                  <span className="font-extrabold text-purple-700 text-sm">
                    ₹{Number(selectedBatch.currentPrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Original Unit Base:</span>
                  <span className="text-gray-500 line-through">
                    ₹{Number(selectedBatch.originalPrice || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-purple-200/60">
                  <span className="font-bold text-gray-800">Total Lot Valuation:</span>
                  <span className="font-black text-gray-900">
                    ₹{Number((selectedBatch.quantity || 0) * (selectedBatch.currentPrice || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Audit & Manufacturing Dates */}
            <div className="bg-gray-50/60 p-4 rounded-2xl border border-gray-200 text-gray-600 space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Manufactured:</span>
                <span className="font-semibold text-gray-800">{formatDate(selectedBatch.manufacturingDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Created in System:</span>
                <span className="font-semibold text-gray-800">{formatDate(selectedBatch.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Telemetry Sync:</span>
                <span className="font-semibold text-gray-800">{formatDate(selectedBatch.updatedAt)}</span>
              </div>
            </div>
          </div>
        )}
      </AdminDetailDrawer>
    </div>
  );
};

export default AdminInventoryPage;
