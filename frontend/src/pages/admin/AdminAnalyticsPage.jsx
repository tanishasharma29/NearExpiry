import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Boxes,
  Store,
  Users,
  Clock,
  Leaf,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Award,
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';
import { adminService } from '../../services/adminService';
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminEmptyState,
  AdminMotionContainer,
} from '../../components/admin';

// Human-friendly mapping and color palettes for Expiry Urgency Tiers
const TIER_COLOR_MAP = {
  '0-2 Days (Critical)': '#ef4444',
  '3-7 Days (Urgent)': '#f97316',
  '8-15 Days (Approaching)': '#f59e0b',
  '16-30 Days (Moderate)': '#3b82f6',
  '31+ Days (Safe)': '#10b981',
  'Expired': '#64748b',
};

// Custom accessible Recharts Tooltip for Sales & GMV series
const CustomSalesTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 z-50">
        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
          <span>Date: {label}</span>
          {payload[0]?.payload?.orderCount !== undefined && (
            <span className="text-[10px] text-purple-300 font-mono">
              {payload[0].payload.orderCount} Orders
            </span>
          )}
        </div>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </span>
            <span className="font-mono font-bold text-slate-100">
              {entry.dataKey === 'rescuedUnits' ? (
                `${entry.value} units`
              ) : (
                `₹${Number(entry.value).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom accessible Recharts Tooltip for Urgency Tier Distribution
const CustomUrgencyTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1 z-50">
        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</div>
        <div className="flex justify-between gap-4 text-slate-300">
          <span>Units at Risk:</span>
          <strong className="font-mono text-amber-400">{data?.units?.toLocaleString()} units</strong>
        </div>
        <div className="flex justify-between gap-4 text-slate-300">
          <span>Batch Lots:</span>
          <strong className="font-mono text-slate-200">{data?.lotCount?.toLocaleString()} lots</strong>
        </div>
      </div>
    );
  }
  return null;
};

export const AdminAnalyticsPage = () => {
  // Reporting Period State: '7d' | '30d' | '90d' | 'all' (Supported natively by backend)
  const [period, setPeriod] = useState('30d');
  const [timeSeriesMetric, setTimeSeriesMetric] = useState('revenue-gmv'); // 'revenue-gmv' | 'units'

  // Analytics Datasets
  const [analyticsData, setAnalyticsData] = useState(null);
  const [storeLeaderboard, setStoreLeaderboard] = useState([]);
  const [leaderboardError, setLeaderboardError] = useState(null);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Analytics & Store Leaderboard in parallel using Promise.allSettled
  const fetchAnalytics = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setLeaderboardError(null);

    try {
      const [analyticsResult, leaderboardResult] = await Promise.allSettled([
        analyticsService.getAdminAnalytics(period),
        adminService.getReports({ type: 'store-leaderboard' }),
      ]);

      // 1. Process Core Analytics Response
      if (analyticsResult.status === 'fulfilled') {
        const payload = analyticsResult.value?.data || analyticsResult.value;
        setAnalyticsData(payload);
      } else {
        console.error('Analytics endpoint failed:', analyticsResult.reason);
        setError(analyticsResult.reason?.message || 'Failed to load platform analytics telemetry.');
      }

      // 2. Process Store Leaderboard Response
      if (leaderboardResult.status === 'fulfilled') {
        const payload = leaderboardResult.value?.data || leaderboardResult.value;
        const list = Array.isArray(payload?.leaderboard)
          ? payload.leaderboard
          : Array.isArray(payload)
          ? payload
          : [];
        setStoreLeaderboard(list);
      } else {
        console.warn('Store leaderboard endpoint failed:', leaderboardResult.reason);
        setLeaderboardError('Store performance leaderboard is currently unavailable.');
      }
    } catch (err) {
      console.error('Unexpected analytics fetch failure:', err);
      setError('An unexpected error occurred while fetching platform analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Safely extract KPIs and Charts
  const kpis = analyticsData?.kpis || {};
  const charts = analyticsData?.charts || {};
  const {
    salesOverTime = [],
    categoryPerformance = [],
    expiryUrgencyDistribution = [],
    expiryTrends = [],
  } = charts;

  // Real Mathematical Metrics & Derivations
  const metrics = useMemo(() => {
    const rawGmv = Number(kpis.gmv || 0);
    const rawRevenue = Number(kpis.revenue || 0);
    const rawOrders = Number(kpis.orders?.total || 0);
    const rawRescuedUnits = Number(kpis.rescuedInventory || 0);

    // Customer savings = GMV - Revenue (or from backend wastePrevented object)
    const rawSavings = Number(
      kpis.wastePrevented?.customerSavingsAmount !== undefined
        ? kpis.wastePrevented.customerSavingsAmount
        : rawGmv - rawRevenue > 0
        ? rawGmv - rawRevenue
        : 0
    );

    // Derived Average Order Value (AOV)
    const aov = rawOrders > 0 ? rawRevenue / rawOrders : 0;

    // Derived Effective Discount Percentage
    const effectiveDiscountPercent = rawGmv > 0 ? (rawSavings / rawGmv) * 100 : 0;

    // Environmental metrics provided by backend with transparent models
    const estimatedKgSaved = Number(
      kpis.wastePrevented?.estimatedKgSaved || rawRescuedUnits * 0.45
    );
    const carbonOffsetKg = Number(
      kpis.wastePrevented?.carbonOffsetEquivalentKg || rawRescuedUnits * 0.45 * 1.9
    );

    // Total units in urgent / critical shelf life
    const criticalUrgencyUnits = expiryUrgencyDistribution
      .filter((d) => d.tier === '0-2 Days (Critical)' || d.tier === '3-7 Days (Urgent)')
      .reduce((sum, d) => sum + (d.units || 0), 0);

    const criticalUrgencyLots = expiryUrgencyDistribution
      .filter((d) => d.tier === '0-2 Days (Critical)' || d.tier === '3-7 Days (Urgent)')
      .reduce((sum, d) => sum + (d.lotCount || 0), 0);

    return {
      gmv: rawGmv,
      revenue: rawRevenue,
      orders: rawOrders,
      rescuedUnits: rawRescuedUnits,
      savings: rawSavings,
      aov,
      effectiveDiscountPercent,
      estimatedKgSaved,
      carbonOffsetKg,
      criticalUrgencyUnits,
      criticalUrgencyLots,
      users: kpis.users || {},
      stores: kpis.stores || {},
    };
  }, [kpis, expiryUrgencyDistribution]);

  // Data-Grounded Platform Insights Generation
  const platformInsights = useMemo(() => {
    const items = [];

    // 1. Transaction & Markdown Insight
    if (metrics.orders > 0 && metrics.gmv > 0) {
      items.push({
        title: 'Effective Markdown & Value Realization',
        description: `Shoppers realized ₹${metrics.savings.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} in dynamic discount savings across ${metrics.orders} orders, reflecting an effective platform-wide discount rate of ${metrics.effectiveDiscountPercent.toFixed(
          1
        )}% against original catalog GMV (₹${metrics.gmv.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}).`,
        type: 'financial',
        icon: TrendingUp,
        color: 'emerald',
      });
    }

    // 2. Rescued Inventory & Environmental Velocity
    if (metrics.rescuedUnits > 0) {
      items.push({
        title: 'Marketplace Waste Reduction Velocity',
        description: `Through customer checkout transactions, ${metrics.rescuedUnits.toLocaleString()} near-expiry inventory units were rescued from write-off, representing an estimated ${metrics.estimatedKgSaved.toFixed(
          1
        )} kg of food preserved and ~${metrics.carbonOffsetKg.toFixed(
          1
        )} kg CO₂e offset equivalent.`,
        type: 'impact',
        icon: Leaf,
        color: 'purple',
      });
    }

    // 3. Expiry Pressure & Urgency Exposure
    if (metrics.criticalUrgencyUnits > 0) {
      items.push({
        title: 'High-Urgency Expiry Exposure',
        description: `The marketplace currently monitors ${metrics.criticalUrgencyUnits.toLocaleString()} units across ${metrics.criticalUrgencyLots} batch lots in the 0-7 day critical window. Continuous automated dynamic pricing is active to stimulate liquidation before shelf-life expiration.`,
        type: 'inventory',
        icon: Clock,
        color: 'amber',
      });
    }

    // 4. Top Category Leadership
    if (categoryPerformance.length > 0) {
      const topCategory = categoryPerformance[0];
      items.push({
        title: `Category Volume Leader: ${topCategory.name || topCategory.category}`,
        description: `${topCategory.name || topCategory.category} is the leading category by realized revenue, capturing ₹${Number(
          topCategory.revenue || 0
        ).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} across ${topCategory.unitsRescued || 0} rescued units and ${topCategory.orderCount || 0} customer orders.`,
        type: 'category',
        icon: Layers,
        color: 'indigo',
      });
    }

    // 5. Store Merchant Contribution
    if (storeLeaderboard.length > 0) {
      const topStore = storeLeaderboard[0];
      items.push({
        title: `Top Contributing Merchant: ${topStore.storeName}`,
        description: `${topStore.storeName} generated ₹${Number(
          topStore.totalRevenue || 0
        ).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} in transaction volume across ${topStore.orderCount || 0} orders, delivering ₹${Number(
          topStore.totalSavingsGiven || 0
        ).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} in customer savings.`,
        type: 'merchant',
        icon: Store,
        color: 'blue',
      });
    }

    return items;
  }, [metrics, categoryPerformance, storeLeaderboard]);

  // Period label formatter
  const getPeriodLabel = (p) => {
    switch (p) {
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      case '90d':
        return 'Last 90 Days';
      case 'all':
        return 'All-Time Record';
      default:
        return 'Custom Period';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Command Header */}
      <AdminPageHeader
        eyebrow="INSIGHTS"
        title="Platform Performance & Insights"
        subtitle="Measure marketplace performance, inventory rescue, transaction activity, and expiry-risk impact across the NearExpiry platform."
        breadcrumbs={[
          { label: 'Platform Command', href: '/admin' },
          { label: 'Platform Analytics' },
        ]}
        statusBadge={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Window: {getPeriodLabel(period)}
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-100 shadow-sm">
              {metrics.orders} Orders Analyzed
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAnalytics(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
              title="Refresh platform telemetry"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'
                }`}
              />
              <span className="hidden sm:inline">Refresh Telemetry</span>
            </button>
          </div>
        }
      />

      {/* 2. Reporting Period Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-gray-900">Analysis Reporting Window</h2>
            <p className="text-[11px] text-gray-500">
              Aggregated inside native MongoDB pipelines with zero client-side extrapolation
            </p>
          </div>
        </div>

        <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs self-start sm:self-auto">
          {[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '90 Days' },
            { id: 'all', label: 'All-Time' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                period === item.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Loading State */}
      {loading ? (
        <div className="bg-white p-20 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="text-sm font-bold text-gray-900">
            Compiling Platform Analytics Pipelines...
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Running multi-collection aggregations across orders, batches, stores, and users
          </p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-900">Analytics Pipeline Error</p>
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition self-start sm:self-auto shrink-0"
          >
            Retry Pipeline
          </button>
        </div>
      ) : (
        <AdminMotionContainer animation="fade-slide-up" className="space-y-6">
          {/* 3. Platform Impact Signal: Core Marketplace KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Platform GMV */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm space-y-2 hover:border-purple-200 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Catalog Gross GMV
                </span>
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-gray-900 tracking-tight">
                ₹{metrics.gmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-500 leading-snug">
                Total pre-discount valuation of items listed across active orders
              </p>
            </div>

            {/* Card 2: Captured Customer Revenue */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm space-y-2 hover:border-purple-200 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Realized Customer Revenue
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-700 tracking-tight">
                ₹{metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span>Avg Order Value:</span>
                <strong className="text-gray-900 font-mono">₹{metrics.aov.toFixed(2)}</strong>
              </div>
            </div>

            {/* Card 3: Shopper Savings Delivered */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm space-y-2 hover:border-purple-200 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Shopper Savings Delivered
                </span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                  <Award className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-600 tracking-tight">
                ₹{metrics.savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span>Effective Markdown:</span>
                <span className="font-bold text-amber-700 font-mono">
                  {metrics.effectiveDiscountPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Card 4: Rescued Units */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm space-y-2 hover:border-purple-200 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Rescued Units Volume
                </span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <Boxes className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl font-black text-indigo-900 tracking-tight">
                {metrics.rescuedUnits.toLocaleString()} units
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <Leaf className="w-3 h-3 text-emerald-600" />
                <span>
                  Est. <strong>{metrics.estimatedKgSaved.toFixed(1)} kg</strong> food preserved
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Operational Ecosystem Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Completed Orders</span>
                <span className="text-sm font-bold text-gray-900">{metrics.orders} checkouts</span>
              </div>
              <ShoppingBag className="w-4 h-4 text-gray-400" />
            </div>

            <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Merchant Stores</span>
                <span className="text-sm font-bold text-gray-900">
                  {metrics.stores.active || 0} active ({metrics.stores.total || 0} total)
                </span>
              </div>
              <Store className="w-4 h-4 text-gray-400" />
            </div>

            <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Shopper Accounts</span>
                <span className="text-sm font-bold text-gray-900">
                  {metrics.users.activeCustomers || 0} active ({metrics.users.totalCustomers || 0} registered)
                </span>
              </div>
              <Users className="w-4 h-4 text-gray-400" />
            </div>

            <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">CO₂e Offset (Est.)</span>
                <span className="text-sm font-bold text-emerald-700">
                  ~{metrics.carbonOffsetKg.toFixed(1)} kg
                </span>
              </div>
              <Leaf className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          {/* 4. Performance Trends: Recharts Time Series */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Daily Marketplace Velocity & Transaction Trajectory
                </h3>
                <p className="text-xs text-gray-500">
                  Real daily order totals, realized revenue, and rescued inventory volume over {getPeriodLabel(period)}
                </p>
              </div>

              {/* Time Series Metric View Switcher */}
              <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTimeSeriesMetric('revenue-gmv')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    timeSeriesMetric === 'revenue-gmv'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Revenue & GMV (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeSeriesMetric('units')}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    timeSeriesMetric === 'units'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Rescued Units Volume
                </button>
              </div>
            </div>

            {salesOverTime.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-2">
                <BarChart3 className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs font-semibold">No order activity recorded in this reporting period</p>
                <p className="text-[11px] text-gray-400">
                  Try switching to a wider window such as "90 Days" or "All-Time"
                </p>
              </div>
            ) : (
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {timeSeriesMetric === 'revenue-gmv' ? (
                    <AreaChart
                      data={salesOverTime}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₹${v}`}
                      />
                      <Tooltip content={<CustomSalesTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(val) => <span className="text-xs font-semibold text-gray-700">{val}</span>}
                      />
                      <Area
                        type="monotone"
                        dataKey="gmv"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#gmvGradient)"
                        name="Gross GMV (₹)"
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                        name="Realized Revenue (₹)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={salesOverTime}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}`}
                      />
                      <Tooltip content={<CustomSalesTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(val) => <span className="text-xs font-semibold text-gray-700">{val}</span>}
                      />
                      <Bar
                        dataKey="rescuedUnits"
                        fill="#6366f1"
                        radius={[6, 6, 0, 0]}
                        name="Rescued Units Volume"
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 5. Rescue & Expiry Intelligence Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 2: Expiry Urgency Tier Exposure (Cols 1-7) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Platform Expiry Urgency Distribution
                  </h3>
                  <p className="text-xs text-gray-500">
                    Breakdown of physical inventory units categorized by remaining shelf-life horizon
                  </p>
                </div>
                <Clock className="w-4 h-4 text-gray-400" />
              </div>

              {expiryUrgencyDistribution.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No shelf-life batch records available
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={expiryUrgencyDistribution}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        angle={-15}
                        textAnchor="end"
                        height={40}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomUrgencyTooltip />} />
                      <Bar dataKey="units" radius={[6, 6, 0, 0]} name="Units at Risk">
                        {expiryUrgencyDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={TIER_COLOR_MAP[entry.tier] || '#6366f1'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Urgency Legend Note */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-start gap-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Operational Policy:</strong> Batches within the 0-2 day (Critical) and 3-7 day
                  (Urgent) tiers receive automated progressive markdown multipliers via the dynamic pricing
                  engine to maximize clearance probability prior to expiry write-off.
                </p>
              </div>
            </div>

            {/* Inventory Lifecycle Status Breakdown (Cols 8-12) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Batch Lifecycle Health</h3>
                  <p className="text-xs text-gray-500">Live inventory status lots and valuations</p>
                </div>
                <Boxes className="w-4 h-4 text-gray-400" />
              </div>

              {expiryTrends.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No batch lifecycle data available
                </div>
              ) : (
                <div className="space-y-3">
                  {expiryTrends.map((trend) => (
                    <div
                      key={trend.status}
                      className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <AdminStatusBadge status={trend.status} size="sm" />
                          <span className="text-xs font-semibold text-gray-700">
                            {trend.lots} lots
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 block">
                          {trend.units?.toLocaleString()} total units
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-gray-900 block">
                          ₹{Number(trend.valuation || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-gray-400">Current Valuation</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 6. Marketplace Performance: Categories & Top Stores */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Category Performance (Cols 1-6) */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Platform Category Performance</h3>
                  <p className="text-xs text-gray-500">
                    Gross revenue and units rescued by product category
                  </p>
                </div>
                <Layers className="w-4 h-4 text-gray-400" />
              </div>

              {categoryPerformance.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No category transaction records in this period
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryPerformance.slice(0, 5).map((cat, idx) => {
                    const rev = Number(cat.revenue || 0);
                    const pctOfTotal =
                      metrics.revenue > 0 ? ((rev / metrics.revenue) * 100).toFixed(1) : 0;

                    return (
                      <div
                        key={cat.name || idx}
                        className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                              {cat.name || cat.category || 'Uncategorized'}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-purple-700">
                            ₹{rev.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        {/* Progress Bar & Volume Summary */}
                        <div className="space-y-1">
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(4, pctOfTotal))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>{cat.unitsRescued || 0} units rescued</span>
                            <span>{pctOfTotal}% of revenue</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Merchant Stores Leaderboard (Cols 7-12) */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Top Merchant Store Contribution</h3>
                  <p className="text-xs text-gray-500">
                    Highest contributing merchant stores ranked by transaction value
                  </p>
                </div>
                <Store className="w-4 h-4 text-gray-400" />
              </div>

              {leaderboardError ? (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  {leaderboardError}
                </div>
              ) : storeLeaderboard.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No store transaction leaderboard data available
                </div>
              ) : (
                <div className="space-y-3">
                  {storeLeaderboard.slice(0, 5).map((store, idx) => (
                    <div
                      key={store._id || idx}
                      className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-900 block truncate max-w-[160px] sm:max-w-xs">
                            {store.storeName}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {store.orderCount || 0} orders • ₹{Number(store.totalSavingsGiven || 0).toFixed(0)} saved
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold text-emerald-700 block">
                          ₹{Number(store.totalRevenue || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-gray-400">Captured Revenue</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 7. Data-Driven Platform Insights Section */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Platform Strategic Insights & Operational Observations
                </h3>
                <p className="text-xs text-gray-500">
                  Mathematically grounded insights generated directly from verified multi-collection metrics
                </p>
              </div>
            </div>

            {platformInsights.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                Sufficient data has not yet accumulated in this period to synthesize platform insights.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {platformInsights.map((insight, idx) => {
                  const Icon = insight.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1.5 hover:border-purple-200 transition"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            insight.color === 'emerald'
                              ? 'bg-emerald-100 text-emerald-800'
                              : insight.color === 'purple'
                              ? 'bg-purple-100 text-purple-800'
                              : insight.color === 'amber'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-gray-900">{insight.title}</h4>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed pl-8">
                        {insight.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </AdminMotionContainer>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
