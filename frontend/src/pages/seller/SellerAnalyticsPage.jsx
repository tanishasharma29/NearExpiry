import React, { useEffect, useState, useMemo } from 'react';
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
  TrendingUp,
  TrendingDown,
  IndianRupee,
  ShoppingBag,
  Package,
  ShieldCheck,
  Calendar,
  RefreshCw,
  Sparkles,
  BarChart3,
  Layers,
  Leaf,
  Activity,
  ArrowRight,
  Info,
  Clock,
  PieChart,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  SellerPageHeader,
  MerchantStatCard,
  StatusBadge,
} from '../../components/seller';

/**
 * Custom Tooltip for Recharts Visualizer
 */
const CustomCurrencyTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1">
        <div className="font-bold text-slate-300 pb-1 border-b border-slate-800">
          {label}
        </div>
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: item.color }}
              />
              {item.name}:
            </span>
            <span className="font-mono font-bold text-white">
              {typeof item.value === 'number'
                ? item.name.includes('₹') || item.name.toLowerCase().includes('revenue') || item.name.toLowerCase().includes('discount')
                  ? `₹${item.value.toFixed(2)}`
                  : item.value
                : item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * SellerAnalyticsPage (Phase 11 Redesign)
 *
 * "Merchant Business Intelligence Center"
 * Purpose: BUSINESS INTELLIGENCE ("What is happening in my store, what changed, and what should I learn from it?")
 *
 * Distinct from:
 * - Dashboard ("What requires attention today?")
 * - FEFO Batches ("Which batch should I sell first?")
 * - Inventory & Stock ("How healthy is my overall inventory?")
 * - Expiry Alerts ("What requires my attention right now?")
 * - Store Orders ("What order needs to move next?")
 * - Billing & Receipts ("What transaction was completed and where is its official receipt?")
 *
 * Features:
 * - 100% preservation of analyticsService.getSellerAnalytics(period)
 * - Period selector ('7d', '30d', '90d', 'all') calling live MongoDB aggregation pipeline
 * - Executive performance summary strip (Revenue, Orders, Rescued Units, Markdown Savings)
 * - Interactive Revenue & Sales Trend chart with metric toggle (Revenue vs Orders)
 * - Category performance breakdown and share analysis
 * - NearExpiry zero-waste environmental rescue metrics (Kg food saved, CO₂e avoided)
 * - Expiry distribution histogram by shelf-life bucket
 * - Transparent, rule-based Merchant Insights
 * - Zero fabricated data, robust empty and error states
 */
export const SellerAnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [chartView, setChartView] = useState('revenue'); // 'revenue' | 'orders'

  const fetchAnalytics = async (selectedPeriod = period, isManualSync = false) => {
    try {
      if (isManualSync) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const anData = await analyticsService.getSellerAnalytics(selectedPeriod);
      setData(anData);
    } catch (err) {
      console.error('Failed to retrieve seller analytics:', err);
      setError(err?.message || 'Unable to load store analytics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const { kpis = {}, charts = {}, store = {} } = data || {};
  const { salesOverTime = [], categoryPerformance = [], expiryDistribution = [] } = charts;

  // Derived Business Intelligence Metrics
  const derivedMetrics = useMemo(() => {
    const ordersCount = kpis.ordersCount || 0;
    const revenue = kpis.revenue || 0;
    const gmv = kpis.gmv || 0;
    const discountAmount = kpis.discountAmount || 0;
    const unitsSold = kpis.unitsSold || 0;

    const avgOrderValue = ordersCount > 0 ? (revenue / ordersCount).toFixed(2) : '0.00';
    const effectiveDiscountPercent = gmv > 0 ? ((discountAmount / gmv) * 100).toFixed(1) : '0.0';

    const topCategory = categoryPerformance.length > 0 ? categoryPerformance[0] : null;
    const totalCategoryRevenue = categoryPerformance.reduce((acc, curr) => acc + (curr.revenue || 0), 0);

    const dailyAvgRevenue =
      salesOverTime.length > 0 ? (revenue / salesOverTime.length).toFixed(2) : '0.00';

    return {
      avgOrderValue,
      effectiveDiscountPercent,
      topCategory,
      totalCategoryRevenue,
      dailyAvgRevenue,
    };
  }, [kpis, categoryPerformance, salesOverTime]);

  const periodLabels = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    all: 'All Time',
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Standardized Seller Page Header */}
      <SellerPageHeader
        badge="BUSINESS INTELLIGENCE"
        title="Store Analytics"
        subtitle="Understand sales, revenue, product performance, and rescue impact to make better decisions for your store."
        showEngineStatus={true}
        breadcrumbs={[
          { label: 'Seller Hub', href: '/seller/dashboard' },
          { label: 'Business Intelligence', href: '/seller/analytics' },
          { label: 'Store Analytics' },
        ]}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period Selector Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              {['7d', '30d', '90d', 'all'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg uppercase transition cursor-pointer ${
                    period === p
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchAnalytics(period, true)}
              disabled={refreshing || loading}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`}
              />
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
          <h3 className="text-base font-bold text-rose-900">Unable to load store analytics</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => fetchAnalytics(period)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Analytics
          </button>
        </div>
      )}

      {/* 3. Executive Performance Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MerchantStatCard
          label="Total Revenue Captured"
          value={loading ? '...' : `₹${Number(kpis.revenue || 0).toFixed(2)}`}
          subtext={`Catalog GMV: ₹${Number(kpis.gmv || 0).toFixed(2)}`}
          icon={IndianRupee}
          variant="emerald"
          badge={periodLabels[period]}
        />

        <MerchantStatCard
          label="Orders Fulfilled"
          value={loading ? '...' : kpis.ordersCount || 0}
          subtext={`Avg Ticket: ₹${derivedMetrics.avgOrderValue}`}
          icon={ShoppingBag}
          variant="navy"
          badge="Completed"
        />

        <MerchantStatCard
          label="Rescued Units Sold"
          value={loading ? '...' : kpis.unitsSold || 0}
          subtext="Saved prior to expiry write-off"
          icon={Package}
          variant="amber"
          badge="Zero-Waste"
        />

        <MerchantStatCard
          label="Customer Markdowns"
          value={loading ? '...' : `₹${Number(kpis.discountAmount || 0).toFixed(2)}`}
          subtext={`${derivedMetrics.effectiveDiscountPercent}% effective markdown`}
          icon={ShieldCheck}
          variant="sky"
          badge="Granted"
        />
      </div>

      {/* 4. Loading State */}
      {loading && (
        <div className="py-20">
          <LoadingSpinner text="Aggregating MongoDB multi-collection time-series telemetry..." />
        </div>
      )}

      {/* 5. Main Performance Chart: Sales & Revenue Over Time */}
      {!loading && !error && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Performance Over Time ({periodLabels[period]})
                </h2>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {salesOverTime.length} Data Points
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily telemetry of captured revenue, customer markdowns, and order fulfillment volume.
              </p>
            </div>

            {/* Chart Metric Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartView('revenue')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  chartView === 'revenue'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Revenue & Discounts (₹)
              </button>
              <button
                type="button"
                onClick={() => setChartView('orders')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  chartView === 'orders'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orders & Units
              </button>
            </div>
          </div>

          {/* Chart Canvas */}
          {salesOverTime.length > 0 ? (
            <div className="h-72 sm:h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'revenue' ? (
                  <AreaChart
                    data={salesOverTime}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="analyticsRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="analyticsDiscGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip content={<CustomCurrencyTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#analyticsRevGrad)"
                      name="Revenue (₹)"
                    />
                    <Area
                      type="monotone"
                      dataKey="discountAmount"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#analyticsDiscGrad)"
                      name="Markdowns (₹)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={salesOverTime}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomCurrencyTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar
                      dataKey="orderCount"
                      fill="#0f172a"
                      radius={[4, 4, 0, 0]}
                      name="Completed Orders"
                    />
                    <Bar
                      dataKey="unitsSold"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      name="Units Rescued"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 text-xs">
              No sales transactions recorded during this period ({periodLabels[period]}). Try selecting a broader period or completing pending pickups.
            </div>
          )}
        </div>
      )}

      {/* 6. Two-Column Analytical Breakdown: Category Performance & Expiry Distribution */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Category Performance */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-600" />
                  <span>Category Revenue Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revenue and units distributed by product category.
                </p>
              </div>
            </div>

            {categoryPerformance.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryPerformance}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                      width={90}
                    />
                    <Tooltip content={<CustomCurrencyTooltip />} />
                    <Bar
                      dataKey="revenue"
                      fill="#0f172a"
                      radius={[0, 6, 6, 0]}
                      name="Revenue (₹)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                No category sales recorded yet for this store.
              </div>
            )}
          </div>

          {/* Right: Expiry Urgency Distribution Histogram */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Expiry Urgency Distribution</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current store catalog batch stock classified by remaining shelf-life bucket.
                </p>
              </div>
            </div>

            {expiryDistribution.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={expiryDistribution}
                    margin={{ top: 5, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip content={<CustomCurrencyTooltip />} />
                    <Bar dataKey="units" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Units in Bucket">
                      {expiryDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.bucket.includes('Critical')
                              ? '#e11d48'
                              : entry.bucket.includes('Urgent')
                              ? '#f97316'
                              : entry.bucket.includes('Approaching')
                              ? '#f59e0b'
                              : entry.bucket.includes('Expired')
                              ? '#64748b'
                              : '#10b981'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                No active inventory batches found in store catalog.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Zero-Waste Environmental Impact & Rescue Mission Panel */}
      {!loading && !error && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 border border-emerald-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Zero-Waste Rescue Impact Metrics
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct environmental and economic value created by fulfilling near-expiry goods before disposal.
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-900/40 px-3 py-1 rounded-full border border-emerald-800 self-start sm:self-auto">
              {store.storeName || 'Neighborhood Partner Store'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Rescued Units</div>
              <div className="text-2xl font-black text-white mt-1">
                {kpis.wastePrevented?.unitsRescued || kpis.unitsSold || 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Commercial items diverted</p>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Est. Food Weight Saved
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {kpis.wastePrevented?.estimatedKgSaved || 0} kg
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Estimated landfill reduction</p>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Est. CO₂e Avoided
              </div>
              <div className="text-2xl font-black text-sky-400 mt-1">
                {kpis.wastePrevented?.co2EquivalentKg || 0} kg
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Greenhouse gas emission offset</p>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Consumer Savings Given
              </div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                ₹{Number(kpis.wastePrevented?.customerSavingsAmount || kpis.discountAmount || 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Hyperlocal markdown value</p>
            </div>
          </div>
        </div>
      )}

      {/* 8. Merchant Business Insights (Rule-based & Transparent) */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Merchant Business Signals & Observations
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ticket Velocity</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Average ticket size is{' '}
                <strong className="text-slate-900">₹{derivedMetrics.avgOrderValue}</strong> across{' '}
                {kpis.ordersCount || 0} completed orders during {periodLabels[period].toLowerCase()}.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-sky-600" />
                <span>Category Leader</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {derivedMetrics.topCategory ? (
                  <>
                    <strong className="text-slate-900">{derivedMetrics.topCategory.name}</strong> leads revenue with{' '}
                    ₹{derivedMetrics.topCategory.revenue.toFixed(2)} ({derivedMetrics.topCategory.unitsSold} units).
                  </>
                ) : (
                  'No dominant sales category identified yet.'
                )}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Catalog Valuation</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Current store stock valuation is{' '}
                <strong className="text-slate-900">
                  ₹{Number(kpis.inventoryValuation || 0).toFixed(2)}
                </strong>{' '}
                across {kpis.totalInventory || 0} remaining units.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerAnalyticsPage;
