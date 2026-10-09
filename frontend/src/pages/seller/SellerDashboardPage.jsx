import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Layers,
  AlertTriangle,
  Clock,
  TrendingUp,
  IndianRupee,
  ArrowRight,
  PlusCircle,
  QrCode,
  CheckCircle2,
  Boxes,
  BellRing,
  ShoppingBag,
  Receipt,
  BarChart3,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Store,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';
import { orderService } from '../../services/orderService';
import { batchService } from '../../services/batchService';
import { sellerService } from '../../services/sellerService';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  SellerPageHeader,
  MerchantStatCard,
  ActionCenterCard,
  RescuePerformanceWidget,
  StatusBadge,
  RiskIndicator,
} from '../../components/seller';

export const SellerDashboardPage = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const [anData, ordData, batchData, verData] = await Promise.all([
        analyticsService.getSellerAnalytics('30d').catch((err) => {
          console.warn('Analytics unavailable or empty', err);
          return null;
        }),
        orderService.getSellerOrders({ limit: 6 }).catch((err) => {
          console.warn('Orders unavailable or empty', err);
          return { orders: [] };
        }),
        batchService.getBatches().catch((err) => {
          console.warn('Batches unavailable or empty', err);
          return { batches: [] };
        }),
        sellerService.getVerificationStatus().catch((err) => {
          console.warn('Verification status unavailable', err);
          return null;
        }),
      ]);

      setAnalytics(anData);
      setRecentOrders(ordData?.orders || []);
      setBatches(batchData?.batches || []);
      if (verData) {
        setVerificationData(verData?.data || verData);
      }
    } catch (err) {
      console.error('Failed to load merchant dashboard', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Connecting to Merchant Command Center..." />;
  }

  const kpis = analytics?.kpis || {};
  const storeName = analytics?.store?.storeName || user?.storeName || 'Merchant Store';

  // 1. Calculate Real Shelf-life Risk Distribution from active batches
  const riskCounts = batches.reduce(
    (acc, b) => {
      const days = b.remainingDays !== undefined ? b.remainingDays : 999;
      if (days < 0 || b.status === 'EXPIRED') acc.expired += 1;
      else if (days === 0) acc.today += 1;
      else if (days <= 3 || b.status === 'CRITICAL') acc.critical += 1;
      else if (days <= 7) acc.urgent += 1;
      else if (days <= 15 || b.status === 'APPROACHING_EXPIRY') acc.approaching += 1;
      else acc.safe += 1;
      return acc;
    },
    { today: 0, critical: 0, urgent: 0, approaching: 0, safe: 0, expired: 0 }
  );

  const totalBatches = batches.length;

  // 2. Derive Real Merchant Action Center Tasks
  const actionItems = [];

  if (riskCounts.today > 0) {
    actionItems.push({
      id: 'today-expiring',
      title: `${riskCounts.today} ${riskCounts.today === 1 ? 'batch expires' : 'batches expire'} today`,
      description: 'Maximum dynamic markdown active. Prioritize customer checkout or store-front staging.',
      severity: 'critical',
      count: riskCounts.today,
      actionLabel: 'Review Batches',
      actionLink: '/seller/batches',
    });
  }

  if (riskCounts.critical > 0) {
    actionItems.push({
      id: 'critical-lots',
      title: `${riskCounts.critical} ${riskCounts.critical === 1 ? 'batch' : 'batches'} in critical window (≤3 days)`,
      description: 'Dynamic discount escalated up to 75% to rescue capital before final shelf expiration.',
      severity: 'warning',
      count: riskCounts.critical,
      actionLabel: 'Expiry Radar',
      actionLink: '/seller/alerts',
    });
  }

  const pickupOrdersCount = recentOrders.filter(
    (o) => o.status === 'READY_FOR_PICKUP' || o.status === 'PACKED'
  ).length;

  if (pickupOrdersCount > 0) {
    actionItems.push({
      id: 'pickup-orders',
      title: `${pickupOrdersCount} ${pickupOrdersCount === 1 ? 'order is' : 'orders are'} ready for customer pickup`,
      description: 'Customer notification dispatched. Awaiting counter pickup and QR verification scan.',
      severity: 'info',
      count: pickupOrdersCount,
      actionLabel: 'Manage Orders',
      actionLink: '/seller/orders',
    });
  }

  if (riskCounts.urgent > 0) {
    actionItems.push({
      id: 'urgent-lots',
      title: `${riskCounts.urgent} ${riskCounts.urgent === 1 ? 'batch' : 'batches'} approaching 4–7 day shelf life`,
      description: 'FEFO dynamic discount rules activated to maintain strong inventory velocity.',
      severity: 'info',
      count: riskCounts.urgent,
      actionLabel: 'Check Batches',
      actionLink: '/seller/batches',
    });
  }

  // Quick Operations Nav Items
  const quickOperations = [
    { label: 'Catalog Products', path: '/seller/products', icon: Package, count: `${kpis.totalInventory || 0} units` },
    { label: 'FEFO Batches', path: '/seller/batches', icon: Layers, count: `${totalBatches} active lots` },
    { label: 'Stock Valuation', path: '/seller/inventory', icon: Boxes, count: 'Live inventory' },
    { label: 'Expiry Alerts', path: '/seller/alerts', icon: BellRing, count: `${riskCounts.today + riskCounts.critical} at risk` },
    { label: 'Store Orders', path: '/seller/orders', icon: ShoppingBag, count: `${recentOrders.length} recent` },
    { label: 'Billing & Receipts', path: '/seller/billing', icon: Receipt, count: 'Tax invoices' },
    { label: 'Store Analytics', path: '/seller/analytics', icon: BarChart3, count: 'Recharts reports' },
  ];

  const effectiveStatus =
    verificationData?.verificationStatus ||
    user?.verificationStatus ||
    user?.store?.verificationStatus ||
    'PENDING';

  const isApproved =
    verificationData?.isApproved ??
    (effectiveStatus === 'APPROVED' || user?.isApproved === true);

  const isRejected =
    verificationData?.isRejected ??
    (effectiveStatus === 'REJECTED');

  const isPending = !isApproved && !isRejected;

  const rejectionReason =
    verificationData?.rejectionReason ||
    user?.sellerProfile?.rejectionReason ||
    null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Dashboard Command Center Header */}
      <SellerPageHeader
        badge="MERCHANT COMMAND CENTER"
        title={storeName}
        subtitle="Your inventory control, shelf-life risk distribution, and food rescue performance — all in one unified control hub."
        showEngineStatus={true}
        actions={
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="Refresh live telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            {isApproved ? (
              <>
                <Link
                  to="/seller/products"
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  <span>+ Add Product</span>
                </Link>

                <Link
                  to="/seller/batches"
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Layers className="w-4 h-4" />
                  <span>Register Batch</span>
                </Link>

                <Link
                  to="/seller/orders"
                  className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan Pickup QR</span>
                </Link>
              </>
            ) : (
              <button
                disabled
                className="px-3.5 py-2.5 bg-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                title="Store operations locked until compliance approval"
              >
                <Lock className="w-4 h-4 text-slate-400" />
                <span>Operations Locked</span>
              </button>
            )}
          </div>
        }
      />

      {/* Verification Status Experience Banner */}
      {isPending && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 flex-shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-sm sm:text-base text-amber-950">
                  Your store application is under review.
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                  Pending Review
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed max-w-2xl">
                Our compliance team is verifying your retail documents and KYC permits. Operational features (product creation, batch listing, inventory changes, and order processing) will be automatically unlocked upon approval.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
            <button
              onClick={() => fetchDashboardData(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Check Status</span>
            </button>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-700 flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-sm sm:text-base text-rose-950">
                  Your store application was rejected.
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-rose-200/80 text-rose-900 border border-rose-300">
                  Application Rejected
                </span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed max-w-2xl">
                {rejectionReason
                  ? `Reason: ${rejectionReason}. Please review your application status and contact support if you need clarification.`
                  : 'Your store application has been rejected. Please review your application status and contact support if you need clarification.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
            <Link
              to="/profile"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-2xs"
            >
              Review Profile
            </Link>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-700 flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-emerald-900">
              Your store has been approved. Store management is available.
            </div>
          </div>
          <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Verified & Active
          </span>
        </div>
      )}

      {/* 2. Operational Inventory KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <MerchantStatCard
          label="Total Inventory Units"
          value={kpis.totalInventory !== undefined ? kpis.totalInventory.toLocaleString('en-IN') : 0}
          subtext="Active stock across all lots"
          icon={Package}
          variant="navy"
        />

        <MerchantStatCard
          label="Critical Risk Stock"
          value={kpis.criticalInventory !== undefined ? kpis.criticalInventory.toLocaleString('en-IN') : 0}
          subtext="≤ 2 days shelf life remaining"
          icon={AlertTriangle}
          variant="rose"
          badge={kpis.criticalInventory > 0 ? '75% OFF' : null}
        />

        <MerchantStatCard
          label="Approaching Expiry"
          value={kpis.expiringInventory !== undefined ? kpis.expiringInventory.toLocaleString('en-IN') : 0}
          subtext="8–15 days shelf life remaining"
          icon={Clock}
          variant="amber"
          badge={kpis.expiringInventory > 0 ? '25-40% OFF' : null}
        />
      </div>

      {/* 3. Merchant Action Center */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Merchant Action Center
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {actionItems.length} {actionItems.length === 1 ? 'action requires attention' : 'actions require attention'}
          </span>
        </div>

        {actionItems.length > 0 ? (
          <div className="space-y-2.5">
            {actionItems.map((item) => (
              <ActionCenterCard
                key={item.id}
                title={item.title}
                description={item.description}
                severity={item.severity}
                count={item.count}
                actionLabel={item.actionLabel}
                actionLink={item.actionLink}
              />
            ))}
          </div>
        ) : (
          <ActionCenterCard
            title="Everything is under control"
            description="No critical inventory or pending order actions require immediate attention. All active batches are within safe shelf-life thresholds."
            severity="success"
            actionLabel="View Inventory"
            actionLink="/seller/inventory"
            icon={CheckCircle2}
          />
        )}
      </div>

      {/* 4. Expiry Risk Overview (Real Segmented Visualizer) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Expiry Risk Radar
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live shelf-life distribution across {totalBatches} registered product lots
            </p>
          </div>
          <Link
            to="/seller/batches"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
          >
            Manage FEFO Lots <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <RiskIndicator
          mode="distribution"
          counts={riskCounts}
          showLabels={true}
        />
      </div>

      {/* 5. Rescue Performance (Sustainability & Capital Recovery) */}
      <RescuePerformanceWidget
        unitsRescued={kpis.unitsSold || 0}
        revenueGenerated={kpis.revenue || 0}
        markdownSavings={kpis.discountSavingsTotal || 0}
        wastePreventedKg={kpis.estimatedKgWasteSaved || 0}
        rescueRatePercent={
          kpis.totalInventory > 0 && kpis.unitsSold
            ? Math.round((kpis.unitsSold / (kpis.totalInventory + kpis.unitsSold)) * 100)
            : null
        }
        periodLabel="Rolling 30 Days"
      />

      {/* 6. Smart Merchant Insights (Rule-based from Real Data) */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider">
            Smart Operational Insights
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
            <span className="font-bold text-emerald-400">FEFO Dispatch Priority</span>
            <p className="text-slate-300 leading-relaxed">
              {riskCounts.today > 0
                ? `${riskCounts.today} ${riskCounts.today === 1 ? 'batch reaches' : 'batches reach'} final expiry today. Review FEFO queue and prioritize for immediate customer checkout.`
                : kpis.criticalInventory > 0
                ? `${kpis.criticalInventory} units are currently in the critical shelf-life window (≤2 days). Prioritize these lots before they reach end-of-life.`
                : `${totalBatches} active lots registered across your catalog. All batches are currently operating within safe shelf-life thresholds.`}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
            <span className="font-bold text-amber-400">Expiry Pressure Window</span>
            <p className="text-slate-300 leading-relaxed">
              {riskCounts.today + riskCounts.critical > 0
                ? `${riskCounts.today + riskCounts.critical} lots are currently in high-urgency tiers (≤3 days). Maximum markdowns are active on customer marketplace.`
                : 'Zero immediate expiry pressure. All registered lots currently possess 4+ days of safe retail shelf life.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
            <span className="font-bold text-sky-400">Order Dispatch Flow</span>
            <p className="text-slate-300 leading-relaxed">
              {recentOrders.length > 0
                ? `${recentOrders.length} recent orders recorded. Store staff can verify customer pickups in Store Orders using the camera QR scanner.`
                : 'No store orders in queue. Ensure products have active batches registered to make them purchasable by nearby customers.'}
            </p>
          </div>
        </div>
      </div>

      {/* 7. Recent Customer Orders Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Recent Customer Orders
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live orders placed by nearby customers awaiting fulfillment or handover
            </p>
          </div>
          <Link
            to="/seller/orders"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
          >
            View All Orders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Fulfillment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Placed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {recentOrders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {ord.items?.length || 0} {ord.items?.length === 1 ? 'item' : 'items'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ₹{Number(ord.pricingSummary?.finalTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {ord.fulfillmentType === 'SELF_PICKUP' ? 'Self Pickup' : ord.fulfillmentType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={ord.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : 'Today'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-2">
            <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No customer orders yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Once nearby customers order products from your store, their orders will appear here for handover and QR verification.
            </p>
          </div>
        )}
      </div>

      {/* 8. Quick Operations Navigation Strip */}
      <div className="bg-slate-100/70 rounded-2xl p-5 border border-slate-200/80 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Quick Operations Shortcuts
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {quickOperations.map((op) => {
            const Icon = op.icon;
            return (
              <Link
                key={op.path}
                to={op.path}
                className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/80 shadow-2xs transition flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition" />
                  <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 truncate">{op.label}</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{op.count}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
