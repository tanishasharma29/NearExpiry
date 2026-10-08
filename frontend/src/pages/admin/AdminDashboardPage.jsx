import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Store,
  Package,
  TrendingUp,
  RefreshCw,
  Leaf,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Boxes,
  Sliders,
  BarChart3,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Activity,
  Layers,
  FileCheck,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminRiskIndicator,
  AdminMotionContainer,
  AdminEmptyState,
} from '../../components/admin';

export const AdminDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [pendingSellersCount, setPendingSellersCount] = useState(0);
  const [pricingRulesCount, setPricingRulesCount] = useState(6);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMessage, setSweepMessage] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch primary dashboard aggregates and secondary live operational metrics in parallel
      const [dashData, sellersData, rulesData, auditData] = await Promise.allSettled([
        adminService.getDashboard(),
        adminService.getSellers({ verificationStatus: 'PENDING', limit: 1 }),
        adminService.getPricingRules(),
        adminService.getAuditLogs({ limit: 4 }),
      ]);

      if (dashData.status === 'fulfilled') {
        setDashboard(dashData.value);
      }
      if (sellersData.status === 'fulfilled') {
        setPendingSellersCount(sellersData.value?.pagination?.total ?? sellersData.value?.sellers?.length ?? 0);
      }
      if (rulesData.status === 'fulfilled') {
        setPricingRulesCount(rulesData.value?.rules?.length ?? 6);
      }
      if (auditData.status === 'fulfilled') {
        setRecentLogs(auditData.value?.logs || []);
      }
    } catch (err) {
      console.error('Error fetching admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const triggerSweep = async () => {
    try {
      setSweeping(true);
      setSweepMessage(null);
      const res = await adminService.triggerPricingSweep();
      const scanned = res?.batchesScanned ?? 0;
      setSweepMessage(`Dynamic sweep executed successfully: ${scanned} batches scanned.`);
      // Refresh dashboard data to reflect latest recalculation
      await fetchDashboardData();
    } catch (err) {
      setSweepMessage(err.message || 'Failed to trigger sweep.');
    } finally {
      setSweeping(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Aggregating NearExpiry platform command telemetry..." />;
  }

  const m = dashboard?.metrics || {};
  const criticalUnits = m.criticalInventory?.units || 0;
  const criticalLots = m.criticalInventory?.lots || 0;
  const nearExpiryUnits = m.nearExpiryInventory?.units || 0;
  const expiredUnits = m.expiredInventory?.units || 0;
  const totalTrackedUnits = criticalUnits + nearExpiryUnits + expiredUnits;

  const rescuedUnits = m.inventoryRescued?.totalRescuedUnits || 0;
  const kgSaved = m.wastePrevented?.estimatedKgSaved || 0;
  const customerSavings = m.wastePrevented?.customerSavingsAmount || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* SECTION A: PLATFORM COMMAND HEADER */}
      <AdminPageHeader
        eyebrow="SYSTEM OVERSEER CONSOLE"
        title="NearExpiry Platform Operations"
        subtitle="Real-time marketplace governance, inventory rescue telemetry, expiry exposure, and platform-wide dynamic pricing enforcement."
        statusBadge={
          <AdminStatusBadge
            status="ACTIVE"
            label="Live Telemetry Synchronized"
            size="sm"
          />
        }
        actions={
          <button
            type="button"
            onClick={triggerSweep}
            disabled={sweeping}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2"
          >
            <RefreshCw className={`w-4 h-4 ${sweeping ? 'animate-spin' : ''}`} />
            <span>{sweeping ? 'Running Engine Sweep...' : 'Trigger Pricing & Expiry Sweep'}</span>
          </button>
        }
      />

      {/* Sweep Feedback Banner */}
      {sweepMessage && (
        <AdminMotionContainer
          animation="fade-slide-up"
          className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-700 flex-shrink-0" />
            <span>{sweepMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSweepMessage(null)}
            className="text-purple-700 hover:text-purple-950 font-bold"
          >
            Dismiss
          </button>
        </AdminMotionContainer>
      )}

      {/* SECTION B: PLATFORM KPI STRIP (TELEMETRY STYLE) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* GMV Telemetry */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Platform GMV
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            ₹{Number(m.revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 pt-1 border-t border-gray-100">
            <span className="font-bold text-gray-800">{m.orders?.total || 0}</span> total orders processed
          </div>
        </AdminMotionContainer>

        {/* Rescued Inventory Telemetry */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Rescued Inventory
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Leaf className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
            {rescuedUnits.toLocaleString('en-IN')} <span className="text-sm font-bold text-emerald-700">units</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 pt-1 border-t border-gray-100">
            <span className="font-bold text-emerald-700">{kgSaved} kg</span> food waste prevented
          </div>
        </AdminMotionContainer>

        {/* Active Stores Telemetry */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Active Stores
            </span>
            <div className="p-1.5 rounded-lg bg-brand-50 text-brand-700">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {m.activeStores || 0}
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 pt-1 border-t border-gray-100">
            <span className="font-bold text-gray-800">{m.totalStores || 0}</span> registered retail permits
          </div>
        </AdminMotionContainer>

        {/* Shopper Accounts Telemetry */}
        <AdminMotionContainer
          hoverEffect
          className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              Shopper Accounts
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {m.totalCustomers || 0}
          </div>
          <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 pt-1 border-t border-gray-100">
            <span className="font-bold text-gray-800">{m.products?.total || 0}</span> catalog master SKUs
          </div>
        </AdminMotionContainer>
      </div>

      {/* SECTION C & D: OPERATIONAL ATTENTION QUEUE & PLATFORM SIGNALS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Attention Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Platform Attention Queue
              </h2>
              <p className="text-xs text-gray-500">
                Prioritized items requiring immediate administrator governance or investigation
              </p>
            </div>
            <AdminStatusBadge
              status={pendingSellersCount > 0 || criticalUnits > 0 ? 'WARNING' : 'HEALTHY'}
              label={pendingSellersCount > 0 || criticalUnits > 0 ? 'Action Required' : 'All Clear'}
              size="sm"
            />
          </div>

          <div className="space-y-3">
            {/* Attention Item 1: Seller Verification Backlog */}
            <AdminMotionContainer
              hoverEffect
              className={`p-4 rounded-2xl border transition-all ${
                pendingSellersCount > 0
                  ? 'bg-amber-50/40 border-amber-200'
                  : 'bg-white border-gray-200/90'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl mt-0.5 ${
                      pendingSellersCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {pendingSellersCount > 0 ? (
                      <Store className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">
                        Seller Verification Queue
                      </span>
                      <AdminRiskIndicator
                        level={pendingSellersCount > 0 ? 'HIGH' : 'LOW'}
                        variant="compact"
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {pendingSellersCount > 0 ? (
                        <>
                          <span className="font-extrabold text-amber-900">{pendingSellersCount} seller application(s)</span> awaiting retail KYC review and store permit approval.
                        </>
                      ) : (
                        'All retail onboarding applications have been reviewed and verified.'
                      )}
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin/sellers"
                  className="self-start sm:self-center px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs rounded-xl shadow-2xs hover:shadow-xs transition inline-flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>Review Sellers</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                </Link>
              </div>
            </AdminMotionContainer>

            {/* Attention Item 2: Critical Expiry Exposure */}
            <AdminMotionContainer
              hoverEffect
              className={`p-4 rounded-2xl border transition-all ${
                criticalUnits > 0
                  ? 'bg-red-50/40 border-red-200'
                  : 'bg-white border-gray-200/90'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl mt-0.5 ${
                      criticalUnits > 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">
                        Critical Expiry Window (≤ 7 Days)
                      </span>
                      <AdminRiskIndicator
                        level={criticalUnits > 0 ? 'CRITICAL' : 'LOW'}
                        variant="compact"
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {criticalUnits > 0 ? (
                        <>
                          <span className="font-extrabold text-red-900">{criticalUnits} units</span> ({criticalLots} lots) entered maximum discount tiers (40-75% markdown).
                        </>
                      ) : (
                        'No platform inventory lots currently sitting in critical shelf-life urgency.'
                      )}
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin/inventory"
                  className="self-start sm:self-center px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs rounded-xl shadow-2xs hover:shadow-xs transition inline-flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>Open Inventory Radar</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                </Link>
              </div>
            </AdminMotionContainer>

            {/* Attention Item 3: Catalog Moderation Queue */}
            <AdminMotionContainer
              hoverEffect
              className="p-4 rounded-2xl border bg-white border-gray-200/90"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl mt-0.5 bg-purple-50 text-purple-700">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">
                        Catalog Moderation Desk
                      </span>
                      <AdminStatusBadge
                        status={m.products?.archived > 0 ? 'ARCHIVED' : 'ACTIVE'}
                        size="sm"
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="font-bold text-gray-900">{m.products?.active || 0}</span> active listings, <span className="font-bold text-gray-900">{m.products?.archived || 0}</span> delisted or archived across merchant stores.
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin/products"
                  className="self-start sm:self-center px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs rounded-xl shadow-2xs hover:shadow-xs transition inline-flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>Review Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                </Link>
              </div>
            </AdminMotionContainer>
          </div>
        </div>

        {/* Right 1 col: Dynamic Pricing Engine & Operational Signals */}
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
            Engine & Operational Signals
          </h2>

          {/* Pricing Engine Control Card */}
          <AdminMotionContainer
            hoverEffect
            className="p-5 rounded-2xl bg-white border border-gray-200/90 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
                Dynamic Pricing Engine
              </span>
              <AdminStatusBadge status="ACTIVE" label="Engine Active" size="sm" />
            </div>

            <div className="space-y-1">
              <div className="text-xl font-black text-gray-900 tracking-tight">
                {pricingRulesCount} Tier Rules Configured
              </div>
              <p className="text-xs text-gray-500">
                Automated FEFO markdown rules ranging from 0% (fresh) up to 75% (critical).
              </p>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <Link
                to="/admin/pricing"
                className="text-xs font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
              >
                <span>Manage Pricing Rules</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </AdminMotionContainer>

          {/* Operational Subsystems Signals */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2.5 text-xs">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
              Operational Subsystems
            </div>

            <div className="flex items-center justify-between text-gray-700">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Inventory Telemetry
              </span>
              <span className="font-bold text-gray-900">{totalTrackedUnits} units tracked</span>
            </div>

            <div className="flex items-center justify-between text-gray-700">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Merchant KYC Engine
              </span>
              <span className="font-bold text-gray-900">{m.totalSellers || 0} sellers verified</span>
            </div>

            <div className="flex items-center justify-between text-gray-700">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Waste Prevention Pipeline
              </span>
              <span className="font-bold text-emerald-700">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION E & F: EXPIRY RADAR SUMMARY & RESCUE IMPACT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section E: Expiry Radar Summary (Horizontal Spectrum) */}
        <AdminMotionContainer
          className="p-5 sm:p-6 rounded-3xl bg-white border border-gray-200/90 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                Platform Expiry Exposure Radar
              </h3>
              <p className="text-xs text-gray-500">
                Unit breakdown across shelf-life urgency tiers
              </p>
            </div>
            <Link
              to="/admin/inventory"
              className="text-xs font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
            >
              <span>Radar Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Segmented Distribution Spectrum */}
          <div className="space-y-2">
            <div className="h-3.5 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
              {totalTrackedUnits > 0 ? (
                <>
                  <div
                    style={{ width: `${Math.max(5, (criticalUnits / totalTrackedUnits) * 100)}%` }}
                    className="bg-red-500 h-full transition-all duration-300"
                    title={`Critical: ${criticalUnits} units`}
                  />
                  <div
                    style={{ width: `${Math.max(5, (nearExpiryUnits / totalTrackedUnits) * 100)}%` }}
                    className="bg-amber-400 h-full transition-all duration-300"
                    title={`Near Expiry: ${nearExpiryUnits} units`}
                  />
                  <div
                    style={{ width: `${Math.max(5, (expiredUnits / totalTrackedUnits) * 100)}%` }}
                    className="bg-gray-400 h-full transition-all duration-300"
                    title={`Expired: ${expiredUnits} units`}
                  />
                </>
              ) : (
                <div className="w-full bg-emerald-400 h-full" title="All inventory safe" />
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              <span className="text-red-700">Critical (≤ 7d)</span>
              <span className="text-amber-700">Near Expiry (8-30d)</span>
              <span className="text-gray-600">Expired</span>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-red-50/60 rounded-xl border border-red-200/80">
              <div className="text-[10px] font-bold uppercase text-red-800">Critical Lots</div>
              <div className="text-lg font-black text-red-900 mt-0.5">{criticalUnits}</div>
              <div className="text-[10px] text-red-700">{criticalLots} active lots</div>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
              <div className="text-[10px] font-bold uppercase text-amber-800">Near Expiry</div>
              <div className="text-lg font-black text-amber-900 mt-0.5">{nearExpiryUnits}</div>
              <div className="text-[10px] text-amber-700">{m.nearExpiryInventory?.lots || 0} active lots</div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-[10px] font-bold uppercase text-gray-700">Expired / Write-Off</div>
              <div className="text-lg font-black text-gray-900 mt-0.5">{expiredUnits}</div>
              <div className="text-[10px] text-gray-500">Locked from sale</div>
            </div>
          </div>
        </AdminMotionContainer>

        {/* Section F: Rescue & Platform Impact */}
        <AdminMotionContainer
          className="p-5 sm:p-6 rounded-3xl bg-white border border-gray-200/90 shadow-xs space-y-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                Platform Food Rescue Impact
              </h3>
              <p className="text-xs text-gray-500">
                Ecosystem metrics converting shelf-life risk into rescued food
              </p>
            </div>
            <Link
              to="/admin/analytics"
              className="text-xs font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
            >
              <span>Platform Trends</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                Landfill Diversion
              </div>
              <div className="text-2xl font-black text-emerald-700">
                {kgSaved} <span className="text-xs font-bold">kg</span>
              </div>
              <p className="text-[11px] text-emerald-800/80">
                Estimated grocery mass saved across completed purchases
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-800">
                Shopper Savings
              </div>
              <div className="text-2xl font-black text-purple-800">
                ₹{Number(customerSavings).toFixed(2)}
              </div>
              <p className="text-[11px] text-purple-800/80">
                Cumulative discount value delivered to consumers
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/70 text-xs text-gray-600 flex items-center justify-between">
            <span>Rescued Customer Transactions</span>
            <span className="font-extrabold text-gray-900">
              {m.inventoryRescued?.rescuedOrdersCount || 0} orders
            </span>
          </div>
        </AdminMotionContainer>
      </div>

      {/* SECTION H: RECENT PLATFORM ACTIVITY STREAM (REAL DATA ONLY) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              Recent Platform Operational Events
            </h3>
            <p className="text-xs text-gray-500">
              Live chronological inventory ledger movements and system audit entries
            </p>
          </div>
        </div>

        {recentLogs && recentLogs.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/90 divide-y divide-gray-100 overflow-hidden shadow-xs">
            {recentLogs.map((log) => (
              <div key={log._id} className="p-4 hover:bg-gray-50/80 transition flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center font-bold flex-shrink-0">
                    <Activity className="w-4 h-4 text-purple-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">
                      {log.actionType || 'INVENTORY_ACTION'} — Batch #{log.batchNumber || log.batchId?.batchNumber || 'N/A'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Store: {log.storeId?.storeName || 'Store'} | Delta: {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange} units
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-[11px] text-gray-400 font-medium">
                    {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            icon={Activity}
            title="No Recent Activity Entries"
            description="Operational events and stock ledger changes will appear here as inventory moves across stores."
          />
        )}
      </div>

      {/* SECTION I: QUICK ADMIN OPERATIONS (COMMAND LAUNCHER) */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
          Platform Operations Command Launcher
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Link
            to="/admin/sellers"
            className="p-3.5 bg-white hover:bg-purple-50/60 border border-gray-200 hover:border-purple-200 rounded-2xl shadow-2xs transition group text-center space-y-1.5"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-gray-100 group-hover:bg-purple-100 text-gray-700 group-hover:text-purple-700 flex items-center justify-center transition">
              <Store className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-gray-900 group-hover:text-purple-900">
              Sellers
            </div>
          </Link>

          <Link
            to="/admin/users"
            className="p-3.5 bg-white hover:bg-purple-50/60 border border-gray-200 hover:border-purple-200 rounded-2xl shadow-2xs transition group text-center space-y-1.5"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-gray-100 group-hover:bg-purple-100 text-gray-700 group-hover:text-purple-700 flex items-center justify-center transition">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-gray-900 group-hover:text-purple-900">
              Users
            </div>
          </Link>

          <Link
            to="/admin/products"
            className="p-3.5 bg-white hover:bg-purple-50/60 border border-gray-200 hover:border-purple-200 rounded-2xl shadow-2xs transition group text-center space-y-1.5"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-gray-100 group-hover:bg-purple-100 text-gray-700 group-hover:text-purple-700 flex items-center justify-center transition">
              <Package className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-gray-900 group-hover:text-purple-900">
              Catalog
            </div>
          </Link>

          <Link
            to="/admin/categories"
            className="p-3.5 bg-white hover:bg-purple-50/60 border border-gray-200 hover:border-purple-200 rounded-2xl shadow-2xs transition group text-center space-y-1.5"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-gray-100 group-hover:bg-purple-100 text-gray-700 group-hover:text-purple-700 flex items-center justify-center transition">
              <Layers className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-gray-900 group-hover:text-purple-900">
              Categories
            </div>
          </Link>

          <Link
            to="/admin/pricing"
            className="p-3.5 bg-white hover:bg-purple-50/60 border border-gray-200 hover:border-purple-200 rounded-2xl shadow-2xs transition group text-center space-y-1.5"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-gray-100 group-hover:bg-purple-100 text-gray-700 group-hover:text-purple-700 flex items-center justify-center transition">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-gray-900 group-hover:text-purple-900">
              Pricing Rules
            </div>
          </Link>

          <Link
            to="/admin/inventory"
            className="p-3.5 bg-white hover:bg-purple-50/60 border border-gray-200 hover:border-purple-200 rounded-2xl shadow-2xs transition group text-center space-y-1.5"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-gray-100 group-hover:bg-purple-100 text-gray-700 group-hover:text-purple-700 flex items-center justify-center transition">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-gray-900 group-hover:text-purple-900">
              Inventory Radar
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
