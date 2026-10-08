import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Package,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  IndianRupee,
  Search,
  Filter,
  RefreshCw,
  Flame,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  X,
  Layers,
  BellRing,
  PieChart,
  BarChart3,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { batchService } from '../../services/batchService';
import { productService } from '../../services/productService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  SellerPageHeader,
  MerchantStatCard,
  StatusBadge,
  RiskIndicator,
} from '../../components/seller';

const KPI_VARIANT_STYLES = {
  navy: {
    accent: 'border-l-slate-900',
    iconBg: 'bg-slate-100 text-slate-800 border-slate-200',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  sky: {
    accent: 'border-l-sky-500',
    iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  rose: {
    accent: 'border-l-rose-500',
    iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  amber: {
    accent: 'border-l-amber-500',
    iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

/**
 * ExpandableInventoryKpiCard
 * Interactive Inventory Health KPI card with upward-revealing animated drawer.
 */
const ExpandableInventoryKpiCard = ({
  id,
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'navy',
  badge,
  isExpanded,
  onToggle,
  expandedContent,
}) => {
  const styles = KPI_VARIANT_STYLES[variant] || KPI_VARIANT_STYLES.navy;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-controls={`${id}-details`}
      aria-label={`${label}: ${value}. Press to ${isExpanded ? 'collapse' : 'expand'} stock health telemetry.`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`group relative bg-white rounded-2xl border p-4 sm:p-5 shadow-sm border-l-4 ${styles.accent} transition-all duration-200 flex flex-col justify-between cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
        isExpanded
          ? 'border-slate-300 ring-1 ring-slate-200 shadow-md'
          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <div>
        {/* Top Header Row: Label + Badge (Left) and Icon (Right) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">
              {label}
            </span>
            {badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${styles.badge}`}>
                {badge}
              </span>
            )}
          </div>

          {Icon && (
            <div className={`p-2 rounded-lg border flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${styles.iconBg}`}>
              <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          )}
        </div>

        {/* Dedicated Full-Width Value Row */}
        <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight break-words py-1">
          {value ?? '—'}
        </div>
      </div>

      {/* Bottom Context Row: Subtext & Interactive Expand Indicator */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
        <div className="truncate text-[11px]">{subtext}</div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors flex-shrink-0">
          <span>{isExpanded ? 'Close' : 'Details'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 transition-transform duration-200 text-slate-700" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 text-slate-400 group-hover:text-slate-600" />
          )}
        </div>
      </div>

      {/* Upward-Opening Animated Details Container */}
      <div
        id={`${id}-details`}
        className={`overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none ${
          isExpanded
            ? 'max-h-96 opacity-100 mt-3 pt-3 border-t border-slate-100'
            : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`transform transition-all duration-300 ease-out motion-reduce:transform-none ${
            isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
          }`}
        >
          {expandedContent}
        </div>
      </div>
    </div>
  );
};

export const SellerInventoryPage = () => {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // ALL | IN_STOCK | OUT_OF_STOCK
  const [sortBy, setSortBy] = useState('RISK_FIRST'); // RISK_FIRST | STOCK_DESC | VALUATION_DESC | PRODUCT_NAME

  // Interactive KPI accordion expansion (null | 'total' | 'stocked' | 'critical' | 'at_risk')
  const [expandedKpi, setExpandedKpi] = useState(null);

  const handleToggleKpi = (key) => {
    setExpandedKpi((prev) => (prev === key ? null : key));
  };

  const loadData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setLoadError('');

      const [bData, pData] = await Promise.all([
        batchService.getBatches({ limit: 100 }),
        productService.getMyProducts({ limit: 100 }).catch(() => productService.getProducts({ limit: 100 })),
      ]);

      const bList = bData?.batches || bData?.data?.batches || (Array.isArray(bData) ? bData : []);
      const pList = pData?.products || pData?.data?.products || (Array.isArray(pData) ? pData : []);

      setBatches(bList);
      setProducts(pList);
    } catch (err) {
      console.error('Failed to load store inventory:', err);
      setLoadError('Unable to load inventory data. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fast Product lookup map
  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      map.set(p._id, p);
    });
    return map;
  }, [products]);

  // 1. Calculate Real Unit-Based Inventory Health Distribution
  const unitHealthDistribution = useMemo(() => {
    const acc = {
      criticalUnits: 0,
      urgentUnits: 0,
      watchUnits: 0,
      healthyUnits: 0,
      expiredUnits: 0,
      totalUnits: 0,
    };

    batches.forEach((b) => {
      const qty = b.quantity || 0;
      acc.totalUnits += qty;
      const days = b.remainingDays !== undefined ? b.remainingDays : 999;

      if (days < 0 || b.status === 'EXPIRED') {
        acc.expiredUnits += qty;
      } else if (days <= 3 || b.status === 'CRITICAL') {
        acc.criticalUnits += qty;
      } else if (days <= 7) {
        acc.urgentUnits += qty;
      } else if (days <= 15 || b.status === 'APPROACHING_EXPIRY') {
        acc.watchUnits += qty;
      } else {
        acc.healthyUnits += qty;
      }
    });

    return acc;
  }, [batches]);

  // 2. Active Batches and Financial Metrics
  const activeBatches = useMemo(() => {
    return batches.filter((b) => b.status !== 'EXPIRED' && (b.remainingDays === undefined || b.remainingDays >= 0));
  }, [batches]);

  const totalStockUnits = useMemo(() => {
    return activeBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
  }, [activeBatches]);

  const activeProductsCount = useMemo(() => {
    const activeProductIds = new Set(
      activeBatches.map((b) => (typeof b.productId === 'object' ? b.productId?._id : b.productId))
    );
    return activeProductIds.size;
  }, [activeBatches]);

  const atRiskUnits = unitHealthDistribution.criticalUnits + unitHealthDistribution.urgentUnits;

  const totalValuation = useMemo(() => {
    return activeBatches.reduce(
      (acc, b) => acc + (b.quantity || 0) * (b.currentPrice !== undefined ? b.currentPrice : b.originalPrice || 0),
      0
    );
  }, [activeBatches]);

  const valueAtRisk = useMemo(() => {
    return activeBatches
      .filter((b) => (b.remainingDays !== undefined && b.remainingDays <= 7) || b.status === 'CRITICAL')
      .reduce((acc, b) => acc + (b.quantity || 0) * (b.originalPrice || 0), 0);
  }, [activeBatches]);

  const potentialRecoveryValue = useMemo(() => {
    return activeBatches
      .filter((b) => (b.remainingDays !== undefined && b.remainingDays <= 7) || b.status === 'CRITICAL')
      .reduce((acc, b) => acc + (b.quantity || 0) * (b.currentPrice || 0), 0);
  }, [activeBatches]);

  // 3. Stock Composition by Category (Answers: "Where is my inventory concentrated?")
  const categoryDistribution = useMemo(() => {
    const catMap = new Map();
    let totalActiveUnitsCount = 0;

    activeBatches.forEach((b) => {
      const prodId = typeof b.productId === 'object' ? b.productId?._id : b.productId;
      const prod = productMap.get(prodId) || (typeof b.productId === 'object' ? b.productId : null);
      const catName =
        (typeof prod?.category === 'object' ? prod?.category?.name : prod?.category) || 'General Category';

      const qty = b.quantity || 0;
      totalActiveUnitsCount += qty;
      catMap.set(catName, (catMap.get(catName) || 0) + qty);
    });

    return Array.from(catMap.entries())
      .map(([category, units]) => ({
        category,
        units,
        percentage: totalActiveUnitsCount > 0 ? Math.round((units / totalActiveUnitsCount) * 100) : 0,
      }))
      .sort((a, b) => b.units - a.units);
  }, [activeBatches, productMap]);

  // 4. Product Health Snapshot (Product-Centric Overview)
  const productHealthSnapshots = useMemo(() => {
    const map = new Map();

    products.forEach((p) => {
      map.set(p._id, {
        product: p,
        totalUnits: 0,
        activeLotsCount: 0,
        nearestExpiryDate: null,
        nearestDays: null,
      });
    });

    activeBatches.forEach((b) => {
      const prodId = typeof b.productId === 'object' ? b.productId?._id : b.productId;
      if (!prodId || !map.has(prodId)) return;

      const item = map.get(prodId);
      item.totalUnits += b.quantity || 0;
      item.activeLotsCount += 1;

      const bDate = new Date(b.expiryDate);
      if (!item.nearestExpiryDate || bDate < item.nearestExpiryDate) {
        item.nearestExpiryDate = bDate;
        item.nearestDays = b.remainingDays;
      }
    });

    return Array.from(map.values())
      .map((item) => {
        let health = 'HEALTHY';
        let healthLabel = 'Healthy';

        if (item.totalUnits === 0) {
          health = 'OUT_OF_STOCK';
          healthLabel = 'Out of Stock';
        } else if (item.nearestDays !== null && item.nearestDays <= 3) {
          health = 'CRITICAL';
          healthLabel = 'Critical (≤3d)';
        } else if (item.nearestDays !== null && item.nearestDays <= 7) {
          health = 'AT_RISK';
          healthLabel = 'At Risk (4–7d)';
        } else if (item.nearestDays !== null && item.nearestDays <= 15) {
          health = 'WATCH';
          healthLabel = 'Watch (8–15d)';
        }

        return {
          ...item,
          health,
          healthLabel,
        };
      })
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 6);
  }, [products, activeBatches]);

  // 5. Inventory Exposure (Top At-Risk Stock Items)
  const atRiskExposureItems = useMemo(() => {
    return activeBatches
      .filter((b) => (b.quantity || 0) > 0 && (b.remainingDays ?? 999) <= 7)
      .sort((a, b) => (a.remainingDays ?? 999) - (b.remainingDays ?? 999))
      .slice(0, 3);
  }, [activeBatches]);

  // 6. Filtered & Sorted Batches for the Operations Table
  const filteredBatches = useMemo(() => {
    let result = batches.filter((b) => {
      const prodId = typeof b.productId === 'object' ? b.productId?._id : b.productId;
      const prod = productMap.get(prodId) || (typeof b.productId === 'object' ? b.productId : null);
      const prodName = prod?.name || '';
      const prodBrand = prod?.brand || '';
      const lotNo = b.batchNumber || '';

      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = prodName.toLowerCase().includes(q);
        const matchBrand = prodBrand.toLowerCase().includes(q);
        const matchLot = lotNo.toLowerCase().includes(q);
        if (!matchTitle && !matchBrand && !matchLot) return false;
      }

      // Risk Filter
      if (riskFilter !== 'ALL') {
        const days = b.remainingDays !== undefined ? b.remainingDays : 999;
        const isExp = days < 0 || b.status === 'EXPIRED';

        if (riskFilter === 'CRITICAL' && (days < 0 || days > 3 || isExp)) return false;
        if (riskFilter === 'AT_RISK' && (days <= 3 || days > 7 || isExp)) return false;
        if (riskFilter === 'WATCH' && (days <= 7 || days > 15 || isExp)) return false;
        if (riskFilter === 'HEALTHY' && (days <= 15 || isExp)) return false;
        if (riskFilter === 'EXPIRED' && !isExp) return false;
      }

      // Stock Status Filter
      if (stockStatusFilter === 'IN_STOCK' && (b.quantity || 0) <= 0) return false;
      if (stockStatusFilter === 'OUT_OF_STOCK' && (b.quantity || 0) > 0) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      const valA = (a.quantity || 0) * (a.currentPrice !== undefined ? a.currentPrice : a.originalPrice || 0);
      const valB = (b.quantity || 0) * (b.currentPrice !== undefined ? b.currentPrice : b.originalPrice || 0);

      if (sortBy === 'RISK_FIRST') {
        return (a.remainingDays ?? 999) - (b.remainingDays ?? 999);
      }
      if (sortBy === 'STOCK_DESC') {
        return (b.quantity || 0) - (a.quantity || 0);
      }
      if (sortBy === 'VALUATION_DESC') {
        return valB - valA;
      }
      if (sortBy === 'PRODUCT_NAME') {
        const prodA = productMap.get(typeof a.productId === 'object' ? a.productId?._id : a.productId);
        const prodB = productMap.get(typeof b.productId === 'object' ? b.productId?._id : b.productId);
        const nameA = prodA?.name || '';
        const nameB = prodB?.name || '';
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return result;
  }, [batches, productMap, searchTerm, riskFilter, stockStatusFilter, sortBy]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setRiskFilter('ALL');
    setStockStatusFilter('ALL');
    setSortBy('RISK_FIRST');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    riskFilter !== 'ALL' ||
    stockStatusFilter !== 'ALL' ||
    sortBy !== 'RISK_FIRST';

  if (loading) {
    return <LoadingSpinner text="Analyzing inventory health & stock valuations..." />;
  }

  const total = unitHealthDistribution.totalUnits || 1;
  const criticalPct = Math.round((unitHealthDistribution.criticalUnits / total) * 100);
  const urgentPct = Math.round((unitHealthDistribution.urgentUnits / total) * 100);
  const watchPct = Math.round((unitHealthDistribution.watchUnits / total) * 100);
  const healthyPct = Math.round((unitHealthDistribution.healthyUnits / total) * 100);
  const expiredPct = Math.round((unitHealthDistribution.expiredUnits / total) * 100);

  const valueExposureRatio = totalValuation > 0 ? Math.min(100, Math.round((valueAtRisk / totalValuation) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Page Header */}
      <SellerPageHeader
        badge="INVENTORY HEALTH"
        title="Inventory & Stock"
        subtitle="Monitor stock health, expiry exposure, and inventory that needs action before it becomes waste."
        showEngineStatus={true}
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="Sync inventory telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Telemetry</span>
            </button>

            <Link
              to="/seller/alerts"
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <BellRing className="w-4 h-4" />
              <span>Review At-Risk Stock</span>
            </Link>
          </div>
        }
      />

      {/* 2. Error Banner */}
      {loadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={() => loadData(true)}
            className="font-bold underline text-rose-950 hover:text-rose-700 ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. ROW 1: Core KPI Row (4 Interactive Expandable Cards - Upward Animated Drawers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {/* KPI 1: TOTAL STOCK UNITS */}
        <ExpandableInventoryKpiCard
          id="kpi-total-stock"
          label="Total Stock Units"
          value={totalStockUnits.toLocaleString('en-IN')}
          subtext="Available physical inventory"
          icon={Boxes}
          variant="navy"
          isExpanded={expandedKpi === 'total'}
          onToggle={() => handleToggleKpi('total')}
          expandedContent={
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 border-b border-slate-200/80 pb-1.5">
                <span>Physical Stock Telemetry</span>
                <span className="font-bold text-slate-800">{activeBatches.length} Active Lots</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Healthy Shelf-Life (&gt;15d):
                  </span>
                  <strong className="text-emerald-700">
                    {unitHealthDistribution.healthyUnits.toLocaleString('en-IN')} units
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Watch &amp; At-Risk (≤15d):
                  </span>
                  <strong className="text-amber-700">
                    {(unitHealthDistribution.watchUnits + atRiskUnits).toLocaleString('en-IN')} units
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 font-semibold">
                  <span className="text-slate-500">Inventory Asset Value:</span>
                  <span className="text-slate-900 font-bold">
                    ₹{Math.round(totalValuation).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          }
        />

        {/* KPI 2: STOCKED PRODUCTS (Renamed from Active SKUs) */}
        <ExpandableInventoryKpiCard
          id="kpi-stocked-products"
          label="Stocked Products"
          value={activeProductsCount}
          subtext="Catalog items with live stock"
          icon={Package}
          variant="sky"
          isExpanded={expandedKpi === 'stocked'}
          onToggle={() => handleToggleKpi('stocked')}
          expandedContent={
            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-sky-800 border-b border-sky-200/80 pb-1.5">
                <span>Catalog Stock Coverage</span>
                <span className="font-bold text-sky-900">
                  {products.length > 0 ? Math.round((activeProductsCount / products.length) * 100) : 0}% Active
                </span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Stocked Products:</span>
                  <strong className="text-slate-900">
                    {activeProductsCount} of {products.length} catalog items
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Out-of-Stock SKUs:</span>
                  <strong className="text-rose-600">
                    {Math.max(0, products.length - activeProductsCount)} products (0 units)
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-sky-200/80 font-semibold">
                  <span className="text-slate-500">Average Lot Density:</span>
                  <span className="text-sky-900 font-bold">
                    {activeProductsCount > 0 ? (activeBatches.length / activeProductsCount).toFixed(1) : 0} lots / product
                  </span>
                </div>
              </div>
            </div>
          }
        />

        {/* KPI 3: CRITICAL UNITS */}
        <ExpandableInventoryKpiCard
          id="kpi-critical-units"
          label="Critical Units"
          value={unitHealthDistribution.criticalUnits.toLocaleString('en-IN')}
          subtext="≤ 3 days shelf life remaining"
          icon={AlertTriangle}
          variant="rose"
          badge={unitHealthDistribution.criticalUnits > 0 ? 'Urgent' : null}
          isExpanded={expandedKpi === 'critical'}
          onToggle={() => handleToggleKpi('critical')}
          expandedContent={
            <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800 border-b border-rose-200/80 pb-1.5">
                <span>Critical Risk Exposure</span>
                <span className="font-bold text-rose-900">≤ 3 Days Remaining</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Impacted Lots:</span>
                  <strong className="text-rose-700">
                    {activeBatches.filter((b) => (b.remainingDays !== undefined && b.remainingDays <= 3) || b.status === 'CRITICAL').length} lots affected
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Share of Inventory:</span>
                  <strong className="text-rose-700">
                    {totalStockUnits > 0 ? ((unitHealthDistribution.criticalUnits / totalStockUnits) * 100).toFixed(1) : 0}% of total units
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-rose-200/80 font-semibold">
                  <span className="text-slate-500">Capital at Imminent Risk:</span>
                  <span className="text-rose-900 font-bold">
                    ₹{Math.round(
                      activeBatches
                        .filter((b) => (b.remainingDays !== undefined && b.remainingDays <= 3) || b.status === 'CRITICAL')
                        .reduce((acc, b) => acc + (b.quantity || 0) * (b.originalPrice || 0), 0)
                    ).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          }
        />

        {/* KPI 4: AT-RISK UNITS */}
        <ExpandableInventoryKpiCard
          id="kpi-at-risk-units"
          label="At-Risk Units"
          value={atRiskUnits.toLocaleString('en-IN')}
          subtext="Entering 4–7 day window"
          icon={Clock}
          variant="amber"
          isExpanded={expandedKpi === 'at_risk'}
          onToggle={() => handleToggleKpi('at_risk')}
          expandedContent={
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 border-b border-amber-200/80 pb-1.5">
                <span>Approaching Expiry (4–7d)</span>
                <span className="font-bold text-amber-900">Urgent Clearance Phase</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Lots in 4–7d Window:</span>
                  <strong className="text-amber-800">
                    {activeBatches.filter((b) => b.remainingDays !== undefined && b.remainingDays > 3 && b.remainingDays <= 7).length} lots approaching
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total 7-Day Exposure:</span>
                  <strong className="text-amber-800">
                    {totalStockUnits > 0 ? ((atRiskUnits / totalStockUnits) * 100).toFixed(1) : 0}% of total units
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-200/80 font-semibold">
                  <span className="text-slate-500">Potential Recovery:</span>
                  <span className="text-amber-900 font-bold">
                    ₹{Math.round(potentialRecoveryValue).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          }
        />
      </div>

      {/* 4. Stock Health Overview (Visual Composition & Breakdown) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>Stock Health Overview (Unit Distribution)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quantifies physical units across shelf-life safety tiers rather than raw batch lots
            </p>
          </div>
          <div className="text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            {unitHealthDistribution.totalUnits.toLocaleString('en-IN')} Total Units Logged
          </div>
        </div>

        {/* Proportional Segmented Meter */}
        <div className="w-full h-3.5 rounded-full bg-slate-100 flex overflow-hidden border border-slate-200/80 shadow-2xs">
          {unitHealthDistribution.criticalUnits > 0 && (
            <div
              style={{ width: `${(unitHealthDistribution.criticalUnits / total) * 100}%` }}
              className="bg-rose-500 transition-all duration-300 hover:opacity-90"
              title={`Critical: ${unitHealthDistribution.criticalUnits} units`}
            />
          )}
          {unitHealthDistribution.urgentUnits > 0 && (
            <div
              style={{ width: `${(unitHealthDistribution.urgentUnits / total) * 100}%` }}
              className="bg-amber-500 transition-all duration-300 hover:opacity-90"
              title={`At Risk: ${unitHealthDistribution.urgentUnits} units`}
            />
          )}
          {unitHealthDistribution.watchUnits > 0 && (
            <div
              style={{ width: `${(unitHealthDistribution.watchUnits / total) * 100}%` }}
              className="bg-amber-300 transition-all duration-300 hover:opacity-90"
              title={`Watch: ${unitHealthDistribution.watchUnits} units`}
            />
          )}
          {unitHealthDistribution.healthyUnits > 0 && (
            <div
              style={{ width: `${(unitHealthDistribution.healthyUnits / total) * 100}%` }}
              className="bg-emerald-500 transition-all duration-300 hover:opacity-90"
              title={`Healthy: ${unitHealthDistribution.healthyUnits} units`}
            />
          )}
          {unitHealthDistribution.expiredUnits > 0 && (
            <div
              style={{ width: `${(unitHealthDistribution.expiredUnits / total) * 100}%` }}
              className="bg-slate-400 transition-all duration-300 hover:opacity-90"
              title={`Expired: ${unitHealthDistribution.expiredUnits} units`}
            />
          )}
        </div>

        {/* 5-Column Health Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/70">
            <div className="flex items-center gap-1.5 font-bold text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Critical (≤3d)</span>
            </div>
            <div className="text-xl font-black text-rose-900 mt-1">
              {unitHealthDistribution.criticalUnits.toLocaleString('en-IN')}{' '}
              <span className="text-[11px] font-normal text-rose-700">units</span>
            </div>
            <div className="text-[11px] text-rose-600 font-medium">{criticalPct}% of inventory</div>
          </div>

          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/70">
            <div className="flex items-center gap-1.5 font-bold text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>At Risk (4–7d)</span>
            </div>
            <div className="text-xl font-black text-amber-900 mt-1">
              {unitHealthDistribution.urgentUnits.toLocaleString('en-IN')}{' '}
              <span className="text-[11px] font-normal text-amber-700">units</span>
            </div>
            <div className="text-[11px] text-amber-600 font-medium">{urgentPct}% of inventory</div>
          </div>

          <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/30">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-300" />
              <span>Watch (8–15d)</span>
            </div>
            <div className="text-xl font-black text-amber-950 mt-1">
              {unitHealthDistribution.watchUnits.toLocaleString('en-IN')}{' '}
              <span className="text-[11px] font-normal text-amber-700">units</span>
            </div>
            <div className="text-[11px] text-amber-700 font-medium">{watchPct}% of inventory</div>
          </div>

          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70">
            <div className="flex items-center gap-1.5 font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Healthy (16+d)</span>
            </div>
            <div className="text-xl font-black text-emerald-900 mt-1">
              {unitHealthDistribution.healthyUnits.toLocaleString('en-IN')}{' '}
              <span className="text-[11px] font-normal text-emerald-700">units</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium">{healthyPct}% of inventory</div>
          </div>

          <div className="p-3 rounded-xl border border-slate-300 bg-slate-100/70">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Expired</span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {unitHealthDistribution.expiredUnits.toLocaleString('en-IN')}{' '}
              <span className="text-[11px] font-normal text-slate-500">units</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">{expiredPct}% locked</div>
          </div>
        </div>
      </div>

      {/* 5. Two-Column Analytical Section: Stock Composition (Left) & Financial Exposure (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Stock Composition (Where is inventory concentrated?) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <span>Stock Composition</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical unit concentration across catalog categories
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {categoryDistribution.length} categories
            </span>
          </div>

          {categoryDistribution.length > 0 ? (
            <div className="space-y-3 pt-1">
              {categoryDistribution.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.category}</span>
                    <span className="font-semibold text-slate-600">
                      {item.units.toLocaleString('en-IN')} units ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="h-full bg-sky-500 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              No categories mapped to active inventory yet.
            </div>
          )}
        </div>

        {/* RIGHT: Dedicated Financial Exposure Panel (Full Space, Zero Overlap) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                <span>Inventory Value Exposure</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial valuation comparison and potential capital recovery
              </p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Active Valuation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Inventory Value
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{Math.round(totalValuation).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500">
                At current dynamic prices across {activeBatches.length} lots
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                Value At Risk (≤ 7d)
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight">
                ₹{Math.round(valueAtRisk).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-amber-700">
                Potential recovery: ₹{Math.round(potentialRecoveryValue).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Exposure Ratio Meter */}
          <div className="pt-2 space-y-1.5 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Financial Exposure Ratio</span>
              <span className="font-bold text-amber-700">{valueExposureRatio}% of capital at risk</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                style={{ width: `${valueExposureRatio}%` }}
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
              />
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5 leading-relaxed">
              NearExpiry dynamic markdown engine automatically lowers prices as expiry approaches to liquidate at-risk capital.
            </p>
          </div>
        </div>
      </div>

      {/* 6. Inventory Exposure (Top At-Risk Stock Focus — Non-FEFO Presentation) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500" />
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              High-Exposure Stock Focus
            </h3>
          </div>
          <Link
            to="/seller/alerts"
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
          >
            <span>Open Expiry Radar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {atRiskExposureItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {atRiskExposureItems.map((b) => {
              const prod = productMap.get(typeof b.productId === 'object' ? b.productId?._id : b.productId);
              const prodName = prod?.name || 'Catalog Product';
              const days = b.remainingDays ?? 0;
              const lotVal = (b.quantity || 0) * (b.currentPrice !== undefined ? b.currentPrice : b.originalPrice || 0);

              return (
                <div
                  key={b._id}
                  className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-sm transition space-y-2.5 border-l-4 border-l-rose-500"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-700 text-[11px]">{b.batchNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
                      {days === 0 ? 'Expires Today' : `${days}d remaining`}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm truncate">{prodName}</h4>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-between">
                      <span>Stock: <strong className="text-slate-900">{b.quantity} units</strong></span>
                      <span className="font-bold text-slate-700">₹{Math.round(lotVal).toLocaleString('en-IN')} exposed</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="font-bold text-emerald-700">
                      ₹{Number(b.currentPrice).toFixed(2)}/unit
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/seller/batches"
                        className="text-xs font-bold text-slate-700 hover:text-emerald-700"
                      >
                        Inspect Lot
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <strong className="font-bold block text-emerald-900">Inventory is healthy</strong>
              <span>No active lots currently require urgent rescue or immediate clearance.</span>
            </div>
          </div>
        )}
      </div>

      {/* 7. Product Health Snapshot (Product-Centric Overview) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>Product Health Snapshot</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated stock volume and nearest expiration per master SKU
            </p>
          </div>
          <Link
            to="/seller/products"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {productHealthSnapshots.map((item) => (
            <div
              key={item.product._id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-xs truncate">{item.product.name}</h4>
                  <div className="text-[11px] text-slate-500">{item.product.brand || 'Store Brand'}</div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0 ${
                    item.health === 'CRITICAL'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : item.health === 'AT_RISK'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : item.health === 'WATCH'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : item.health === 'OUT_OF_STOCK'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {item.healthLabel}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 text-slate-600">
                <span>Stock: <strong className="text-slate-900">{item.totalUnits} units</strong></span>
                <span>{item.activeLotsCount} active lots</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product title, brand, or lot number..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Sorting */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Risk Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">🔴 Critical (≤3d)</option>
              <option value="AT_RISK">🟠 At Risk (4–7d)</option>
              <option value="WATCH">🟡 Watch (8–15d)</option>
              <option value="HEALTHY">🟢 Healthy (16+d)</option>
              <option value="EXPIRED">⚪ Expired</option>
            </select>

            {/* Stock Status Filter */}
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="IN_STOCK">In Stock (&gt; 0)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0)</option>
            </select>

            {/* Sorting */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="RISK_FIRST">Highest Expiry Risk First</option>
              <option value="STOCK_DESC">Highest Stock Units</option>
              <option value="VALUATION_DESC">Highest Lot Valuation (₹)</option>
              <option value="PRODUCT_NAME">Product Name (A–Z)</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="py-2 px-3 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Displaying <strong className="text-slate-900">{filteredBatches.length}</strong> of{' '}
            <strong className="text-slate-900">{batches.length}</strong> inventory lot records
          </span>
          {hasActiveFilters && (
            <span className="text-[11px] text-emerald-600 font-semibold">
              Filters applied
            </span>
          )}
        </div>
      </div>

      {/* 9. Inventory Operations Table (Desktop/Tablet) + Mobile Cards */}
      {filteredBatches.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Lot #</th>
                  <th className="py-3.5 px-4">Available Units</th>
                  <th className="py-3.5 px-4">Expiry Countdown</th>
                  <th className="py-3.5 px-4">Unit Price</th>
                  <th className="py-3.5 px-4">Lot Valuation</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredBatches.map((b) => {
                  const prod = productMap.get(typeof b.productId === 'object' ? b.productId?._id : b.productId);
                  const prodName = prod?.name || 'Catalog Item';
                  const prodBrand = prod?.brand || '';
                  const lotValuation = (b.quantity || 0) * (b.currentPrice !== undefined ? b.currentPrice : b.originalPrice || 0);

                  return (
                    <tr key={b._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product Name & Brand */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 text-sm">{prodName}</div>
                          {prodBrand && <div className="text-slate-500 text-[11px]">{prodBrand}</div>}
                        </div>
                      </td>

                      {/* Lot # */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {b.batchNumber}
                      </td>

                      {/* Available Units & Stock Status */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-black text-slate-900 text-sm">
                            {b.quantity} <span className="text-slate-500 text-xs font-normal">units</span>
                          </div>
                          <div>
                            {b.quantity > 0 ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                In Stock
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Expiry Countdown */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="text-slate-700">
                            {new Date(b.expiryDate).toLocaleDateString()}
                          </div>
                          <RiskIndicator mode="single" days={b.remainingDays} status={b.status} />
                        </div>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900">
                            ₹{Number(b.currentPrice).toFixed(2)}
                          </div>
                          {b.discountPercentage > 0 && (
                            <div className="text-[10px] font-semibold text-emerald-600">
                              {b.discountPercentage}% discount active
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Lot Valuation */}
                      <td className="py-3.5 px-4 font-black text-slate-900">
                        ₹{Math.round(lotValuation).toLocaleString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            to="/seller/batches"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Inspect in FEFO Batches"
                          >
                            <Layers className="w-4 h-4" />
                          </Link>
                          <Link
                            to="/seller/alerts"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Open Expiry Radar"
                          >
                            <BellRing className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredBatches.map((b) => {
              const prod = productMap.get(typeof b.productId === 'object' ? b.productId?._id : b.productId);
              const prodName = prod?.name || 'Catalog Item';
              const prodBrand = prod?.brand || '';
              const lotValuation = (b.quantity || 0) * (b.currentPrice !== undefined ? b.currentPrice : b.originalPrice || 0);

              return (
                <div key={b._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-600 block">
                        {b.batchNumber}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">{prodName}</h4>
                      {prodBrand && <div className="text-xs text-slate-500">{prodBrand}</div>}
                    </div>

                    <RiskIndicator mode="single" days={b.remainingDays} status={b.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Available Stock</span>
                      <span className="font-bold text-slate-900">{b.quantity} units</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Lot Valuation</span>
                      <span className="font-bold text-emerald-700">
                        ₹{Math.round(lotValuation).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Unit Price</span>
                      <span className="font-bold text-slate-900">₹{Number(b.currentPrice).toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to="/seller/batches"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                      >
                        FEFO
                      </Link>
                      <Link
                        to="/seller/alerts"
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs"
                      >
                        Alert
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty States */
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Boxes className="w-6 h-6" />
          </div>
          {hasActiveFilters ? (
            <div>
              <h3 className="text-base font-bold text-slate-900">No matching inventory records</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                No lots match your current search query or risk filters.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-base font-bold text-slate-900">Your inventory is currently empty</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Register a batch lot to start tracking stock valuations and automated expiry rescue.
              </p>
              <Link
                to="/seller/batches"
                className="mt-4 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition inline-flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4" />
                <span>+ Register First Lot in FEFO</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
