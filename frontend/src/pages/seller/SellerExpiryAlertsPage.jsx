import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  X,
  ArrowRight,
  ExternalLink,
  Package,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
  Tag,
  Check,
  TrendingDown,
  Info,
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  SellerPageHeader,
  MerchantStatCard,
  StatusBadge,
  RiskIndicator,
} from '../../components/seller';

/**
 * SellerExpiryAlertsPage (Phase 8 Redesign)
 *
 * "NearExpiry Alert Command Center" / Operational Attention Queue
 * Purpose: ATTENTION & RESPONSE ("What requires my attention right now?")
 *
 * Distinct from:
 * - FEFO Batches ("Which batch should I sell first?")
 * - Inventory & Stock ("How healthy is my overall inventory?")
 *
 * Features:
 * - 100% preservation of inventoryService.getExpiryAlerts() and acknowledgeExpiryAlert()
 * - Real-time alert summary metrics (Critical, Needs Action, Unacknowledged, Acknowledged)
 * - Critical Attention Required hero section prioritizing urgent unacknowledged items
 * - Alert Inbox / Attention Queue with clear severity, metrics, and direct batch links
 * - Rich filter & search toolbar (Product, Batch, Message, Severity, Acknowledged status, Expiry window)
 * - Optimistic UI updates on acknowledgement with in-app confirmation
 * - Zero fabricated data, robust empty and error states
 */
export const SellerExpiryAlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'needs_attention' | 'critical' | 'acknowledged'
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'CRITICAL' | 'WARNING' | 'EXPIRED_LOCKOUT'
  const [windowFilter, setWindowFilter] = useState('all'); // 'all' | 'urgent' | 'critical' | 'approaching' | 'expired'

  // Fetch Expiry Alerts from existing backend API
  const fetchAlerts = async (isManualSync = false) => {
    try {
      if (isManualSync) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Pass limit: 100 to retrieve full store alert registry
      const data = await inventoryService.getExpiryAlerts({ limit: 100 });
      setAlerts(data?.alerts || []);

      if (isManualSync) {
        setFeedbackMessage({
          type: 'success',
          text: 'Alert telemetry synchronized with live scheduler registry.',
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      }
    } catch (err) {
      console.error('Failed to fetch expiry alerts:', err);
      setError(err?.message || 'Unable to load expiry alerts. Please check connectivity and retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Acknowledge Alert Handler preserving existing backend PATCH /api/v1/expiry/alerts/:id/acknowledge
  const handleAcknowledgeAlert = async (alertId, batchLabel) => {
    if (!alertId || acknowledgingId) return;

    try {
      setAcknowledgingId(alertId);
      await inventoryService.acknowledgeExpiryAlert(alertId);

      // Optimistically update the alert in local state
      setAlerts((prevAlerts) =>
        prevAlerts.map((item) =>
          item._id === alertId
            ? { ...item, isAcknowledged: true, acknowledgedAt: new Date().toISOString() }
            : item
        )
      );

      setFeedbackMessage({
        type: 'success',
        text: `Alert acknowledged for batch ${batchLabel || 'lot'}. Inventory audit trail updated.`,
      });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Failed to acknowledge alert. Please try again.',
      });
      setTimeout(() => setFeedbackMessage(null), 6000);
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Helper: Format Dates safely
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

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Helper: Resolve effective remaining days for an alert
  const getRemainingDays = (al) => {
    if (al.batchId && typeof al.batchId.remainingDays === 'number') {
      return al.batchId.remainingDays;
    }
    if (typeof al.remainingDaysAtTrigger === 'number') {
      return al.remainingDaysAtTrigger;
    }
    return null;
  };

  // Helper: Resolve affected quantity
  const getQuantity = (al) => {
    if (al.batchId && typeof al.batchId.quantity === 'number') {
      return al.batchId.quantity;
    }
    if (typeof al.quantityAtTrigger === 'number') {
      return al.quantityAtTrigger;
    }
    return 0;
  };

  // Helper: Resolve product name
  const getProductName = (al) => {
    return al.productId?.name || al.title || 'Product';
  };

  // Helper: Resolve batch lot number
  const getBatchNumber = (al) => {
    return al.batchId?.batchNumber || al.batchNumber || 'N/A';
  };

  // Derived Real Metrics (Strictly from loaded alerts dataset)
  const metrics = useMemo(() => {
    const total = alerts.length;
    const critical = alerts.filter(
      (a) =>
        a.severity === 'CRITICAL' ||
        a.alertType === 'CRITICAL_EXPIRY' ||
        a.alertType === 'FINAL_48H_CRITICAL'
    ).length;

    const unacknowledged = alerts.filter((a) => !a.isAcknowledged).length;
    const acknowledged = alerts.filter((a) => a.isAcknowledged).length;

    const criticalUnacknowledged = alerts.filter(
      (a) =>
        !a.isAcknowledged &&
        (a.severity === 'CRITICAL' ||
          a.alertType === 'CRITICAL_EXPIRY' ||
          a.alertType === 'FINAL_48H_CRITICAL')
    );

    const totalUnitsAffected = alerts.reduce((acc, curr) => acc + getQuantity(curr), 0);
    const discountedCount = alerts.filter(
      (a) => (a.discountPercentageApplied || 0) > 0
    ).length;

    return {
      total,
      critical,
      unacknowledged,
      acknowledged,
      criticalUnacknowledged,
      totalUnitsAffected,
      discountedCount,
    };
  }, [alerts]);

  // Filtered Alert List
  const filteredAlerts = useMemo(() => {
    return alerts.filter((al) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const pName = getProductName(al).toLowerCase();
        const brand = (al.productId?.brand || '').toLowerCase();
        const bNum = getBatchNumber(al).toLowerCase();
        const title = (al.title || '').toLowerCase();
        const msg = (al.message || '').toLowerCase();

        const matchesSearch =
          pName.includes(query) ||
          brand.includes(query) ||
          bNum.includes(query) ||
          title.includes(query) ||
          msg.includes(query);

        if (!matchesSearch) return false;
      }

      // 2. Active Tab
      if (activeTab === 'needs_attention' && al.isAcknowledged) {
        return false;
      }
      if (activeTab === 'critical') {
        const isCrit =
          al.severity === 'CRITICAL' ||
          al.alertType === 'CRITICAL_EXPIRY' ||
          al.alertType === 'FINAL_48H_CRITICAL';
        if (!isCrit) return false;
      }
      if (activeTab === 'acknowledged' && !al.isAcknowledged) {
        return false;
      }

      // 3. Severity filter
      if (severityFilter !== 'all' && al.severity !== severityFilter) {
        return false;
      }

      // 4. Window filter
      if (windowFilter !== 'all') {
        const days = getRemainingDays(al);
        if (days === null) return true;
        if (windowFilter === 'urgent' && !(days >= 0 && days <= 2)) return false;
        if (windowFilter === 'critical' && !(days >= 3 && days <= 7)) return false;
        if (windowFilter === 'approaching' && !(days >= 8 && days <= 30)) return false;
        if (windowFilter === 'expired' && !(days < 0)) return false;
      }

      return true;
    });
  }, [alerts, searchQuery, activeTab, severityFilter, windowFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    activeTab !== 'all' ||
    severityFilter !== 'all' ||
    windowFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setActiveTab('all');
    setSeverityFilter('all');
    setWindowFilter('all');
  };

  const scrollToCritical = () => {
    const el = document.getElementById('critical-attention-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setActiveTab('critical');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Standardized Seller Page Header */}
      <SellerPageHeader
        badge="RESCUE OPERATIONS"
        title="Expiry Alerts"
        subtitle="Prioritize expiry risks, acknowledge critical alerts, and take action before inventory becomes waste."
        showEngineStatus={true}
        breadcrumbs={[
          { label: 'Seller Hub', href: '/seller/dashboard' },
          { label: 'Rescue Operations', href: '/seller/batches' },
          { label: 'Expiry Alerts' },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            {metrics.criticalUnacknowledged.length > 0 && (
              <button
                type="button"
                onClick={scrollToCritical}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Review Critical Alerts ({metrics.criticalUnacknowledged.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchAlerts(true)}
              disabled={refreshing || loading}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              title="Synchronize alert telemetry with database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>{refreshing ? 'Syncing...' : 'Sync Telemetry'}</span>
            </button>
          </div>
        }
      />

      {/* Inline Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium transition-all duration-300 animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:bg-black/5 rounded-md text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. ALERT STATUS RAIL (Compact operational status rail instead of 4 large dashboard cards) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Segment 1: Critical */}
          <button
            type="button"
            onClick={() => setActiveTab('critical')}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer group ${
              activeTab === 'critical' ? 'bg-rose-50/70' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full bg-rose-600 ${metrics.criticalUnacknowledged.length > 0 ? 'animate-ping' : ''}`} />
                Critical
              </span>
              <span className="text-xl sm:text-2xl font-black text-rose-950 font-mono">
                {loading ? '...' : metrics.critical}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
              <span>{metrics.criticalUnacknowledged.length > 0 ? `${metrics.criticalUnacknowledged.length} need action` : 'Immediate attention'}</span>
            </div>
          </button>

          {/* Segment 2: Action Required */}
          <button
            type="button"
            onClick={() => setActiveTab('needs_attention')}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer group ${
              activeTab === 'needs_attention' ? 'bg-amber-50/70' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Action Required
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-950 font-mono">
                {loading ? '...' : metrics.unacknowledged}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span>Awaiting response</span>
            </div>
          </button>

          {/* Segment 3: Unacknowledged */}
          <button
            type="button"
            onClick={() => setActiveTab('needs_attention')}
            className="p-3.5 sm:p-4 text-left transition-colors cursor-pointer hover:bg-slate-50 group"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Unacknowledged
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {loading ? '...' : metrics.unacknowledged}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
              <span>Pending sign-off</span>
            </div>
          </button>

          {/* Segment 4: Acknowledged */}
          <button
            type="button"
            onClick={() => setActiveTab('acknowledged')}
            className={`p-3.5 sm:p-4 text-left transition-colors cursor-pointer group ${
              activeTab === 'acknowledged' ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Acknowledged
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-950 font-mono">
                {loading ? '...' : metrics.acknowledged}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span>Resolved audit trail</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Error Banner if fetch failed */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-rose-100 text-rose-600 mb-1">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-rose-900">Unable to load expiry alerts</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => fetchAlerts()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
          </button>
        </div>
      )}

      {/* 4. Incident Spotlight (Operational Incident Response Desk) */}
      {!loading && !error && (
        <div id="critical-attention-section">
          {metrics.criticalUnacknowledged.length > 0 ? (
            <div className="bg-white rounded-2xl border border-rose-300 border-l-4 border-l-rose-600 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-600 text-white shadow-xs flex-shrink-0 animate-pulse">
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-wider uppercase text-rose-900 bg-rose-100 px-2 py-0.5 rounded">
                        CRITICAL INCIDENT SPOTLIGHT
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white font-mono">
                        {metrics.criticalUnacknowledged.length} PENDING
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 font-medium">
                      High-priority expiry risks identified by automated engine. Immediate merchant action required to prevent stock write-offs.
                    </p>
                  </div>
                </div>

                <Link
                  to="/seller/batches"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 flex-shrink-0"
                >
                  <span>Open Batch Rescue Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Spotlight on Most Urgent Critical Alert */}
              {metrics.criticalUnacknowledged[0] && (
                <div className="bg-rose-50/40 rounded-xl border border-rose-200/90 p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status="CRITICAL" label="Critical Expiry" size="sm" pulse={true} />
                        <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-0.5 rounded border border-rose-200">
                          LOT: {getBatchNumber(metrics.criticalUnacknowledged[0])}
                        </span>
                        {metrics.criticalUnacknowledged[0].productId?.brand && (
                          <span className="text-xs text-slate-500 font-medium">
                            {metrics.criticalUnacknowledged[0].productId.brand}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        {getProductName(metrics.criticalUnacknowledged[0])}
                      </h3>

                      <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                        {metrics.criticalUnacknowledged[0].message || metrics.criticalUnacknowledged[0].title}
                      </p>

                      <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-700 flex-wrap pt-1">
                        <span className="inline-flex items-center gap-1.5 text-rose-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-rose-200">
                          <Clock className="w-3.5 h-3.5 text-rose-600" />
                          {getRemainingDays(metrics.criticalUnacknowledged[0]) !== null
                            ? getRemainingDays(metrics.criticalUnacknowledged[0]) <= 0
                              ? 'Expired / Locked'
                              : `${getRemainingDays(metrics.criticalUnacknowledged[0])} days remaining`
                            : 'Urgent'}
                        </span>

                        <span className="inline-flex items-center gap-1.5 text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          {getQuantity(metrics.criticalUnacknowledged[0])} units affected
                        </span>

                        {(metrics.criticalUnacknowledged[0].discountPercentageApplied || 0) > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            {metrics.criticalUnacknowledged[0].discountPercentageApplied}% Auto-Discount Active
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 font-normal">
                          Triggered: {formatDate(metrics.criticalUnacknowledged[0].createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Action Controls for Spotlight Alert */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleAcknowledgeAlert(
                            metrics.criticalUnacknowledged[0]._id,
                            getBatchNumber(metrics.criticalUnacknowledged[0])
                          )
                        }
                        disabled={acknowledgingId === metrics.criticalUnacknowledged[0]._id}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {acknowledgingId === metrics.criticalUnacknowledged[0]._id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Acknowledging...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Acknowledge Alert</span>
                          </>
                        )}
                      </button>

                      <Link
                        to="/seller/batches"
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-center inline-flex items-center justify-center gap-1"
                      >
                        <span>Review Batch</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Compact secondary list if there are multiple critical unacknowledged alerts */}
              {metrics.criticalUnacknowledged.length > 1 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                    Additional Critical Alerts ({metrics.criticalUnacknowledged.length - 1})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {metrics.criticalUnacknowledged.slice(1, 5).map((otherAlert) => (
                      <div
                        key={otherAlert._id}
                        className="p-3 bg-white/95 rounded-xl border border-rose-200/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {getProductName(otherAlert)}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-medium text-slate-700">
                              Batch #{getBatchNumber(otherAlert)}
                            </span>
                            <span>•</span>
                            <span className="text-rose-600 font-semibold">
                              {getRemainingDays(otherAlert) !== null
                                ? `${getRemainingDays(otherAlert)}d left`
                                : 'Critical'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleAcknowledgeAlert(otherAlert._id, getBatchNumber(otherAlert))
                          }
                          disabled={acknowledgingId === otherAlert._id}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition flex-shrink-0 cursor-pointer"
                        >
                          {acknowledgingId === otherAlert._id ? 'Saving...' : 'Acknowledge'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : alerts.length > 0 ? (
            /* Reassuring Banner When No Critical Alerts Exist */
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    No Critical Alerts Pending
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    All immediate critical risks are acknowledged or within safe dynamic-pricing tolerance. Ongoing automated monitoring remains active.
                  </p>
                </div>
              </div>

              <Link
                to="/seller/batches"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 flex-shrink-0"
              >
                <span>Inspect FEFO Batches</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {/* 5. Transparent Rule-Based Operational Summary */}
      {!loading && !error && alerts.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-300">
                Operational Telemetry Insights
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated from scheduled cron sweeps. Dynamic pricing rules actively regulate batch market velocity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 text-xs border-t md:border-t-0 pt-2 md:pt-0 border-slate-800 flex-wrap">
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Flagged Units
              </div>
              <div className="text-sm font-black text-white">
                {metrics.totalUnitsAffected} units
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Discounted Lots
              </div>
              <div className="text-sm font-black text-amber-400">
                {metrics.discountedCount} lots
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Resolution Rate
              </div>
              <div className="text-sm font-black text-emerald-400">
                {metrics.total > 0
                  ? `${Math.round((metrics.acknowledged / metrics.total) * 100)}%`
                  : '100%'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Filter & Search Toolbar */}
      {!loading && !error && alerts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
          {/* Top Row: Quick Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Alerts ({alerts.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('needs_attention')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'needs_attention'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Needs Attention ({metrics.unacknowledged})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('critical')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'critical'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Critical Only ({metrics.critical})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('acknowledged')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'acknowledged'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Acknowledged ({metrics.acknowledged})</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Showing {filteredAlerts.length} of {alerts.length} alerts
            </div>
          </div>

          {/* Bottom Row: Search & Dropdowns */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by product, brand, batch #, or message..."
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
              {/* Severity Dropdown */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="EXPIRED_LOCKOUT">Expired Lockout</option>
              </select>

              {/* Expiry Window Dropdown */}
              <select
                value={windowFilter}
                onChange={(e) => setWindowFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Expiry Windows</option>
                <option value="urgent">0–2 Days (Urgent Rescue)</option>
                <option value="critical">3–7 Days (Critical)</option>
                <option value="approaching">8–30 Days (Approaching)</option>
                <option value="expired">Expired (&lt; 0 Days)</option>
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

      {/* 7. Loading State */}
      {loading && (
        <div className="py-16">
          <LoadingSpinner text="Scanning alert radar and synchronizing telemetry..." />
        </div>
      )}

      {/* 8. ATTENTION TIMELINE / ALERT STREAM (Incident Stream with vertical connecting track) */}
      {!loading && !error && filteredAlerts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            <span className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Attention Timeline &amp; Alert Stream</span>
            </span>
            <span className="font-mono text-slate-400">{filteredAlerts.length} Actionable Items</span>
          </div>

          {/* Connected Operational Stream */}
          <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200/90 space-y-5 ml-2.5 sm:ml-4 pt-1">
            {filteredAlerts.map((al) => {
              const days = getRemainingDays(al);
              const qty = getQuantity(al);
              const pName = getProductName(al);
              const bNum = getBatchNumber(al);
              const isCrit =
                al.severity === 'CRITICAL' ||
                al.alertType === 'CRITICAL_EXPIRY' ||
                al.alertType === 'FINAL_48H_CRITICAL';
              const isExpired = al.severity === 'EXPIRED_LOCKOUT' || (days !== null && days < 0);
              const timeDisplay = formatTimeOnly(al.createdAt);

              return (
                <div key={al._id} className="relative group">
                  {/* Timeline Stream Node */}
                  <div
                    className={`absolute -left-[31px] sm:-left-[39px] top-4 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                      isCrit && !al.isAcknowledged
                        ? 'border-rose-600'
                        : isExpired
                        ? 'border-slate-500'
                        : !al.isAcknowledged
                        ? 'border-amber-500'
                        : 'border-emerald-500'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCrit && !al.isAcknowledged
                          ? 'bg-rose-600 animate-pulse'
                          : isExpired
                          ? 'bg-slate-500'
                          : !al.isAcknowledged
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Incident Stream Card */}
                  <div
                    className={`relative bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-2xs hover:shadow-sm ${
                      !al.isAcknowledged
                        ? isCrit
                          ? 'border-rose-300 border-l-4 border-l-rose-600 bg-gradient-to-r from-rose-50/20 to-white'
                          : isExpired
                          ? 'border-slate-300 border-l-4 border-l-slate-400 bg-slate-50/20'
                          : 'border-amber-200 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/15 to-white'
                        : 'border-slate-200/80 border-l-4 border-l-emerald-500/60 bg-white opacity-95'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Timestamp Marker, Severity, Details */}
                      <div className="space-y-2 flex-1">
                        {/* Timeline Timestamp & Meta Pill Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Operational Time Marker */}
                          <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <span className="text-slate-400">●</span>
                            <span>{timeDisplay || 'ALERT'}</span>
                          </span>

                          {isCrit ? (
                            <StatusBadge status="CRITICAL" label="Critical Expiry" size="sm" pulse={!al.isAcknowledged} />
                          ) : isExpired ? (
                            <StatusBadge status="EXPIRED" label="Expired Lockout" size="sm" />
                          ) : (
                            <StatusBadge status="APPROACHING_EXPIRY" label="Warning" size="sm" />
                          )}

                          {!al.isAcknowledged ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Action Required</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Acknowledged</span>
                            </span>
                          )}

                          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            LOT: {bNum}
                          </span>

                          {al.productId?.brand && (
                            <span className="text-xs text-slate-500 font-medium">
                              {al.productId.brand}
                            </span>
                          )}
                        </div>

                        {/* Product Name & Alert Title */}
                        <div>
                          <div className="text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>{pName}</span>
                            <span className="text-xs font-bold text-slate-400">•</span>
                            <span className="text-xs font-bold text-slate-700">{al.title}</span>
                          </div>

                          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                            {al.message}
                          </p>
                        </div>

                        {/* Trigger Specs Strip */}
                        <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-700 flex-wrap pt-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                              days !== null && days <= 2
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : days !== null && days <= 7
                                ? 'bg-orange-50 border-orange-200 text-orange-700'
                                : 'bg-amber-50 border-amber-200 text-amber-800'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>
                              {days !== null
                                ? days < 0
                                  ? 'Expired'
                                  : `${days} days remaining`
                                : 'Pending evaluation'}
                            </span>
                          </span>

                          <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg">
                            <Package className="w-3 h-3 text-slate-500" />
                            <span>{qty} units affected</span>
                          </span>

                          {(al.discountPercentageApplied || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg">
                              <Tag className="w-3 h-3 text-emerald-600" />
                              <span>{al.discountPercentageApplied}% discount applied</span>
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400 font-normal">
                            Triggered: {formatDate(al.createdAt)}
                          </span>

                          {al.isAcknowledged && al.acknowledgedAt && (
                            <span className="text-[11px] text-emerald-700 font-medium">
                              Signed off: {formatDate(al.acknowledgedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Operational Action Buttons */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-shrink-0">
                        {!al.isAcknowledged ? (
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeAlert(al._id, bNum)}
                            disabled={acknowledgingId === al._id}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {acknowledgingId === al._id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Acknowledging...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Acknowledge</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Acknowledged</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Link
                            to="/seller/batches"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition inline-flex items-center gap-1"
                          >
                            <span>Review Batch</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>

                          <Link
                            to="/seller/products"
                            className="hidden sm:inline-flex px-2 py-1.5 text-xs text-slate-400 hover:text-slate-700 transition"
                          >
                            Catalog
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. Empty State: Filters produced 0 results */}
      {!loading && !error && alerts.length > 0 && filteredAlerts.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-slate-100 text-slate-500 mb-1">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No alerts match your current filters</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your search query, clearing severity filters, or switching back to "All Alerts".
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

      {/* 10. Empty State: No alerts in store radar (Positive "All Clear" State) */}
      {!loading && !error && alerts.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="inline-flex p-4 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-100 mb-1">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900">You're All Clear</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            No expiry alerts require your attention right now. All active batches across your store catalog are within safe shelf life thresholds.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              to="/seller/batches"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Inspect Active Batches</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchAlerts(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh Radar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerExpiryAlertsPage;
