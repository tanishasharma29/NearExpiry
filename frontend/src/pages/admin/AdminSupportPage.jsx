import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LifeBuoy,
  AlertTriangle,
  AlertOctagon,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Store,
  User,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  RotateCcw,
  Eye,
  ShieldAlert,
  FileQuestion,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  MessageSquare,
  Lock,
  Send,
  FileText,
  Check,
  ChevronRight,
  DollarSign,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Scale,
  MessageCircle,
  CornerDownRight,
  Sparkles,
  CheckSquare,
  Tag,
  PackageCheck,
  UserCheck,
} from 'lucide-react';
import { complaintService } from '../../services/complaintService';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
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

// =========================================================================
// ENUMS & LABELS
// =========================================================================

const COMPLAINT_STATUS = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  WAITING_FOR_CUSTOMER: 'WAITING_FOR_CUSTOMER',
  WAITING_FOR_SELLER: 'WAITING_FOR_SELLER',
  RESOLUTION_PENDING: 'RESOLUTION_PENDING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
};

const COMPLAINT_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

const CATEGORY_LABELS = {
  ORDER_NOT_RECEIVED: 'Order Not Received',
  WRONG_PRODUCT: 'Wrong Product Received',
  DAMAGED_PRODUCT: 'Damaged / Leaking Product',
  EXPIRED_OR_UNSAFE_PRODUCT: 'Expired / Unsafe Product',
  MISSING_ITEM: 'Missing Item from Order',
  PAYMENT_PROBLEM: 'Payment Issue',
  REFUND_PROBLEM: 'Refund Issue',
  PICKUP_PROBLEM: 'Store Pickup Issue',
  DELIVERY_PROBLEM: 'Delivery Problem',
  PRODUCT_QUALITY: 'Product Quality Defect',
  SELLER_DISPUTE: 'Seller Dispute',
  OTHER: 'Other Issue',
};

const RESOLUTION_DECISION_OPTIONS = [
  { value: 'FULL_REFUND', label: 'Full Refund to Customer' },
  { value: 'PARTIAL_REFUND', label: 'Partial Refund to Customer' },
  { value: 'ORDER_CANCELLATION', label: 'Order Cancellation & Restock' },
  { value: 'REPLACEMENT_APPROVED', label: 'Replacement Approved' },
  { value: 'REJECTED_INVALID', label: 'Claim Rejected (Invalid / Fraudulent)' },
  { value: 'RESOLVED_WITH_EXPLANATION', label: 'Resolved with Operational Explanation' },
  { value: 'STORE_CREDIT', label: 'Store Credit Issued' },
];

const RESOLUTION_ACTION_TYPES = [
  { value: 'NONE', label: 'Decision Only (No automated financial/inventory mutation)' },
  { value: 'EXECUTE_REFUND', label: 'Execute Real Payment Refund via Gateway' },
  { value: 'EXECUTE_ORDER_CANCEL', label: 'Execute Order Cancellation & Inventory Restock' },
  { value: 'BOTH', label: 'Both: Execute Payment Refund & Cancel Order with Restock' },
];

const VALID_STATUS_TRANSITIONS = {
  OPEN: ['UNDER_REVIEW', 'REJECTED', 'CLOSED'],
  UNDER_REVIEW: [
    'WAITING_FOR_CUSTOMER',
    'WAITING_FOR_SELLER',
    'RESOLUTION_PENDING',
    'RESOLVED',
    'CLOSED',
    'REJECTED',
  ],
  WAITING_FOR_CUSTOMER: ['UNDER_REVIEW', 'CLOSED', 'REJECTED'],
  WAITING_FOR_SELLER: ['UNDER_REVIEW', 'RESOLUTION_PENDING', 'CLOSED', 'REJECTED'],
  RESOLUTION_PENDING: ['UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'UNDER_REVIEW'],
  CLOSED: [],
  REJECTED: [],
};

export const AdminSupportPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkComplaintId = searchParams.get('id');

  // Primary Complaints State
  const [complaints, setComplaints] = useState([]);
  const [totalComplaintsCount, setTotalComplaintsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Real Exception Orders for Transaction Dispute Context
  const [exceptionOrders, setExceptionOrders] = useState([]);
  const [loadingExceptions, setLoadingExceptions] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'exceptions'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dossier Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData] = useState(null);
  const [dossierError, setDossierError] = useState(null);
  const [dossierTab, setDossierTab] = useState('overview'); // 'overview' | 'messages' | 'notes' | 'timeline' | 'settlement'

  // Drawer Operations State
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  // Customer Response & Internal Notes Composer
  const [customerMessage, setCustomerMessage] = useState('');
  const [sendingCustomerMessage, setSendingCustomerMessage] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [addingInternalNote, setAddingInternalNote] = useState(false);

  // Resolution Workspace State
  const [resolutionDecision, setResolutionDecision] = useState('FULL_REFUND');
  const [actionRequested, setActionRequested] = useState('NONE');
  const [refundAmount, setRefundAmount] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState(null);
  const [resolutionSuccess, setResolutionSuccess] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Exception Order Drawer State
  const [selectedExceptionOrder, setSelectedExceptionOrder] = useState(null);
  const [exceptionDrawerOpen, setExceptionDrawerOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch Complaints & Real Platform Telemetry
  // -------------------------------------------------------------------------
  const fetchComplaintsData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = {
        page,
        limit: 25,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;

      const res = await complaintService.getAdminComplaints(params);
      const list = res?.data || res?.complaints || (Array.isArray(res) ? res : []);
      const meta = res?.meta || res?.pagination || {};

      setComplaints(list);
      setTotalComplaintsCount(meta.total || list.length);
      setTotalPages(meta.totalPages || 1);
    } catch (err) {
      console.error('Failed to load admin complaints:', err);
      setError(err?.message || 'Failed to retrieve marketplace dispute records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter, priorityFilter, categoryFilter]);

  // Fetch Transaction Exceptions (Real Cancelled / Failed Payment Orders)
  const fetchExceptionsData = useCallback(async () => {
    try {
      setLoadingExceptions(true);
      const ordersRes = await adminService.getOrders({ limit: 50 });
      const orderList = Array.isArray(ordersRes)
        ? ordersRes
        : ordersRes?.orders || ordersRes?.data?.orders || [];

      const exceptions = orderList.filter(
        (o) => o.status === 'CANCELLED' || o.paymentStatus === 'FAILED'
      );
      setExceptionOrders(exceptions);
    } catch (err) {
      console.warn('Could not load transaction exceptions for dispute context:', err);
    } finally {
      setLoadingExceptions(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaintsData();
  }, [fetchComplaintsData]);

  useEffect(() => {
    fetchExceptionsData();
  }, [fetchExceptionsData]);

  // -------------------------------------------------------------------------
  // Real KPI Metrics Computed from DB Records
  // -------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = totalComplaintsCount;
    let openCount = 0;
    let waitingCount = 0;
    let criticalCount = 0;
    let resolvedCount = 0;

    complaints.forEach((c) => {
      if (c.status === 'OPEN' || c.status === 'UNDER_REVIEW') openCount += 1;
      if (c.status === 'WAITING_FOR_CUSTOMER' || c.status === 'WAITING_FOR_SELLER') waitingCount += 1;
      if (c.priority === 'CRITICAL' || c.priority === 'HIGH') criticalCount += 1;
      if (c.status === 'RESOLVED' || c.status === 'CLOSED') resolvedCount += 1;
    });

    return {
      total,
      open: openCount,
      waiting: waitingCount,
      critical: criticalCount,
      resolved: resolvedCount,
    };
  }, [complaints, totalComplaintsCount]);

  // High Priority / Safety Risk Callout Cases
  const safetyRiskCases = useMemo(() => {
    return complaints.filter(
      (c) =>
        (c.priority === 'CRITICAL' || c.category === 'EXPIRED_OR_UNSAFE_PRODUCT') &&
        c.status !== 'RESOLVED' &&
        c.status !== 'CLOSED' &&
        c.status !== 'REJECTED'
    );
  }, [complaints]);

  // -------------------------------------------------------------------------
  // Inspect Complaint Dossier
  // -------------------------------------------------------------------------
  const handleOpenDossier = useCallback(async (complaintId) => {
    if (!complaintId) return;
    const cleanId = String(complaintId);
    setSelectedComplaintId(cleanId);
    setDrawerOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get('id') !== cleanId) {
        next.set('id', cleanId);
      }
      return next;
    }, { replace: true });
    setDossierLoading(true);
    setDossierError(null);
    setDossierTab('overview');
    setResolutionError(null);
    setResolutionSuccess(null);

    try {
      const res = await complaintService.getAdminComplaintDossier(cleanId);
      const data = res?.data || res;
      const complaint = data?.complaint;
      const orderDossier = data?.orderDossier;
      const relatedOrderComplaints = data?.relatedOrderComplaints || [];
      const customerDisputeCount = data?.customerDisputeCount || 1;

      setDossierData({
        complaint,
        orderDossier,
        relatedOrderComplaints,
        customerDisputeCount,
      });

      // Pre-fill default refund amount from payment if available
      if (orderDossier?.paymentId?.amount) {
        setRefundAmount(String(orderDossier.paymentId.amount));
      } else if (orderDossier?.pricingSummary?.finalTotal) {
        setRefundAmount(String(orderDossier.pricingSummary.finalTotal));
      } else {
        setRefundAmount('0');
      }
    } catch (err) {
      console.error('Failed to load complaint dossier:', err);
      setDossierError(err?.message || 'Could not load complete dossier.');
    } finally {
      setDossierLoading(false);
    }
  }, [setSearchParams]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedComplaintId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('id');
      return next;
    });
  }, [setSearchParams]);

  // Handle direct URL deep-linking (?id=...) on initial load
  useEffect(() => {
    if (deepLinkComplaintId && deepLinkComplaintId !== selectedComplaintId && !drawerOpen) {
      handleOpenDossier(deepLinkComplaintId);
    }
  }, [deepLinkComplaintId, selectedComplaintId, drawerOpen, handleOpenDossier]);

  const reloadCurrentDossier = async () => {
    if (!selectedComplaintId) return;
    try {
      const res = await complaintService.getAdminComplaintDossier(selectedComplaintId);
      const data = res?.data || res;
      const complaint = data?.complaint;
      const orderDossier = data?.orderDossier;
      const relatedOrderComplaints = data?.relatedOrderComplaints || [];
      const customerDisputeCount = data?.customerDisputeCount || 1;

      setDossierData({
        complaint,
        orderDossier,
        relatedOrderComplaints,
        customerDisputeCount,
      });
      fetchComplaintsData(true);
    } catch (err) {
      console.error('Failed to reload dossier:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Triage Operations: Status, Priority, Assign
  // -------------------------------------------------------------------------
  const handleUpdateStatus = async (nextStatus) => {
    if (!selectedComplaintId || !nextStatus) return;
    try {
      setStatusUpdating(true);
      await complaintService.updateComplaintStatus(selectedComplaintId, {
        status: nextStatus,
        note: statusNote.trim() || `Status updated to ${nextStatus}`,
      });
      setStatusNote('');
      await reloadCurrentDossier();
    } catch (err) {
      alert(`Status transition failed: ${err?.message || 'Invalid state change'}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleUpdatePriority = async (nextPriority) => {
    if (!selectedComplaintId || !nextPriority) return;
    try {
      setPriorityUpdating(true);
      await complaintService.updateComplaintPriority(selectedComplaintId, {
        priority: nextPriority,
        note: `Priority changed to ${nextPriority}`,
      });
      await reloadCurrentDossier();
    } catch (err) {
      alert(`Priority update failed: ${err?.message || 'Could not update priority'}`);
    } finally {
      setPriorityUpdating(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedComplaintId || !user?._id) return;
    try {
      setAssigningAdmin(true);
      await complaintService.assignComplaint(selectedComplaintId, {
        adminId: user._id,
      });
      await reloadCurrentDossier();
    } catch (err) {
      alert(`Assignment failed: ${err?.message || 'Could not assign moderator'}`);
    } finally {
      setAssigningAdmin(false);
    }
  };

  // -------------------------------------------------------------------------
  // Customer Message & Internal Note Composers
  // -------------------------------------------------------------------------
  const handleSendCustomerMessage = async (e) => {
    e.preventDefault();
    if (!customerMessage.trim() || !selectedComplaintId) return;
    try {
      setSendingCustomerMessage(true);
      await complaintService.sendAdminMessage(selectedComplaintId, {
        message: customerMessage.trim(),
        attachments: [],
        isInternalNote: false,
      });
      setCustomerMessage('');
      await reloadCurrentDossier();
    } catch (err) {
      alert(`Failed to send message: ${err?.message}`);
    } finally {
      setSendingCustomerMessage(false);
    }
  };

  const handleAddInternalNote = async (e) => {
    e.preventDefault();
    if (!internalNote.trim() || !selectedComplaintId) return;
    try {
      setAddingInternalNote(true);
      await complaintService.addAdminInternalNote(selectedComplaintId, {
        note: internalNote.trim(),
      });
      setInternalNote('');
      await reloadCurrentDossier();
    } catch (err) {
      alert(`Failed to add internal note: ${err?.message}`);
    } finally {
      setAddingInternalNote(false);
    }
  };

  // -------------------------------------------------------------------------
  // Resolution Execution with Safety Confirmation
  // -------------------------------------------------------------------------
  const handleExecuteResolution = async () => {
    if (!selectedComplaintId) return;
    if (!resolutionNotes.trim()) {
      setResolutionError('Resolution settlement notes are mandatory for auditing.');
      return;
    }

    try {
      setResolving(true);
      setResolutionError(null);

      const payload = {
        decision: resolutionDecision,
        notes: resolutionNotes.trim(),
        actionRequested,
        refundAmount: Number(refundAmount) || 0,
      };

      const result = await complaintService.resolveComplaint(selectedComplaintId, payload);
      setResolutionSuccess(result);
      setConfirmModalOpen(false);
      await reloadCurrentDossier();
    } catch (err) {
      console.error('Resolution failed:', err);
      setResolutionError(err?.message || 'Resolution execution failed.');
      setConfirmModalOpen(false);
    } finally {
      setResolving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Formatters
  // -------------------------------------------------------------------------
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

  const calculateDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    const exp = new Date(expiryDate);
    const diffTime = exp.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filtered Exceptions for Tab 2
  const filteredExceptions = useMemo(() => {
    return exceptionOrders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchNum = order.orderNumber?.toLowerCase().includes(q);
        const matchCust = order.customerId?.name?.toLowerCase().includes(q);
        const matchStore = order.storeId?.storeName?.toLowerCase().includes(q);
        const matchReason = order.cancellation?.reason?.toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchStore && !matchReason) return false;
      }
      return true;
    });
  }, [exceptionOrders, statusFilter, search]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || statusFilter || priorityFilter || categoryFilter);

  // Active Complaint Details
  const activeComplaint = dossierData?.complaint;
  const activeOrder = dossierData?.orderDossier;

  // Allowed next statuses for the current complaint
  const allowedTransitions = activeComplaint?.status
    ? VALID_STATUS_TRANSITIONS[activeComplaint.status] || []
    : [];

  // Filter messages into public dialogue and confidential internal notes
  const publicMessages = (activeComplaint?.messages || []).filter((m) => !m.isInternalNote);
  const internalNotesList = (activeComplaint?.messages || []).filter((m) => m.isInternalNote);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Command Header */}
      <AdminPageHeader
        eyebrow="PLATFORM OPERATIONS"
        title="Platform Resolution Center"
        subtitle="Centralize customer complaints, merchant dispute arbitration, cancellation settlements, and multi-tier escrow resolutions."
        breadcrumbs={[
          { label: 'Platform Command', href: '/admin' },
          { label: 'Platform Resolution Center' },
        ]}
        statusBadge={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{totalComplaintsCount} Total Dispute Case(s) Active</span>
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchComplaintsData(true);
                fetchExceptionsData();
              }}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
              title="Refresh case status"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`}
              />
              <span className="hidden sm:inline">Refresh Sync</span>
            </button>
          </div>
        }
      />

      {/* 2. Real KPI Metrics Strip (Accurately computed from DB records) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Intake */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Total Intake
            </span>
            <LifeBuoy className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900">{stats.total}</span>
            <span className="text-[10px] text-gray-400 font-semibold">Cases Logged</span>
          </div>
        </div>

        {/* Under Active Review */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Under Review
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-900">{stats.open}</span>
            <span className="text-[10px] text-blue-600 font-semibold">In Triage</span>
          </div>
        </div>

        {/* Awaiting Parties */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Awaiting Info
            </span>
            <MessageSquare className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900">{stats.waiting}</span>
            <span className="text-[10px] text-amber-600 font-semibold">Customer / Store</span>
          </div>
        </div>

        {/* Critical & High Risk */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
              High / Critical
            </span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-900">{stats.critical}</span>
            <span className="text-[10px] text-rose-600 font-semibold">Urgent Action</span>
          </div>
        </div>

        {/* Settled / Resolved */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Settled Cases
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900">{stats.resolved}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Resolved</span>
          </div>
        </div>
      </div>

      {/* 3. High-Priority Safety & Escalation Alert Banner */}
      {safetyRiskCases.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <h3 className="font-extrabold text-rose-950 text-xs sm:text-sm">
                Critical Safety Concern or High-Priority Disputes ({safetyRiskCases.length} Unresolved)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900 uppercase">
              Immediate Triage Required
            </span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            NearExpiry food safety protocols prioritize cases flagged with expired/unsafe inventory or high dispute severity. Review batch telemetry and order records immediately.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {safetyRiskCases.slice(0, 3).map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => handleOpenDossier(item._id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-rose-100/80 text-rose-900 text-xs font-bold rounded-lg border border-rose-300 transition shadow-xs"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{item.complaintNumber}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-700 truncate max-w-[140px]">{item.subject}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Operational Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'cases'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Active Complaint &amp; Dispute Queue</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === 'cases' ? 'bg-white/20' : 'bg-gray-200 text-gray-700'
          }`}>
            {totalComplaintsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exceptions')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'exceptions'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Transaction Exceptions ({exceptionOrders.length})</span>
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            Live Orders Context
          </span>
        </button>
      </div>

      {/* 5. TAB 1: Real Complaints & Disputes Queue */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          {/* Universal Filter Bar */}
          <AdminFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            searchPlaceholder="Search complaints by case ID, order #, customer, store, or subject..."
            filters={[
              {
                id: 'status',
                label: 'Status',
                value: statusFilter,
                onChange: (val) => {
                  setStatusFilter(val);
                  setPage(1);
                },
                icon: Filter,
                options: [
                  { value: '', label: 'All Statuses' },
                  { value: 'OPEN', label: 'Open' },
                  { value: 'UNDER_REVIEW', label: 'Under Review' },
                  { value: 'WAITING_FOR_CUSTOMER', label: 'Waiting for Customer' },
                  { value: 'WAITING_FOR_SELLER', label: 'Waiting for Seller' },
                  { value: 'RESOLUTION_PENDING', label: 'Resolution Pending' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'CLOSED', label: 'Closed' },
                  { value: 'REJECTED', label: 'Rejected' },
                ],
              },
              {
                id: 'priority',
                label: 'Priority',
                value: priorityFilter,
                onChange: (val) => {
                  setPriorityFilter(val);
                  setPage(1);
                },
                icon: AlertOctagon,
                options: [
                  { value: '', label: 'All Priorities' },
                  { value: 'CRITICAL', label: 'Critical' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'LOW', label: 'Low' },
                ],
              },
              {
                id: 'category',
                label: 'Category',
                value: categoryFilter,
                onChange: (val) => {
                  setCategoryFilter(val);
                  setPage(1);
                },
                icon: Tag,
                options: [
                  { value: '', label: 'All Categories' },
                  ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({
                    value: k,
                    label: v,
                  })),
                ],
              },
            ]}
            totalResults={totalComplaintsCount}
            filteredCount={complaints.length}
            hasActiveFilters={hasActiveFilters}
            onClear={handleClearFilters}
          />

          {/* Table / List View */}
          {loading ? (
            <div className="bg-white p-16 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <LoadingSpinner text="Retrieving marketplace dispute cases and dossiers..." />
            </div>
          ) : complaints.length === 0 ? (
            <AdminEmptyState
              icon={LifeBuoy}
              title={hasActiveFilters ? 'No Matching Dispute Cases' : 'No Customer Complaints Filed'}
              description={
                hasActiveFilters
                  ? 'No complaints match the specified search query or category filters.'
                  : 'Customer satisfaction is high! There are currently zero open disputes or complaints in the NearExpiry database.'
              }
              actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
              actionIcon={hasActiveFilters ? RotateCcw : undefined}
              onAction={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Case ID &amp; Priority</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Order &amp; Store</th>
                      <th className="py-3 px-4">Category &amp; Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Logged</th>
                      <th className="py-3 px-4">Moderator</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {complaints.map((c) => {
                      const isCritical = c.priority === 'CRITICAL';
                      const isHigh = c.priority === 'HIGH';
                      return (
                        <tr
                          key={c._id}
                          className={`hover:bg-purple-50/40 transition-colors ${
                            isCritical ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          {/* Case ID & Priority */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="font-bold text-gray-900 tracking-tight">
                                {c.complaintNumber}
                              </span>
                              <div className="flex items-center gap-1">
                                <AdminStatusBadge status={c.priority} size="sm" />
                                {c.evidenceUrls?.length > 0 && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 font-semibold px-1.5 py-0.5 rounded">
                                    {c.evidenceUrls.length} file(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">
                              {c.customerId?.name || 'Customer'}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate max-w-[140px]">
                              {c.customerId?.email || 'N/A'}
                            </div>
                          </td>

                          {/* Order & Store */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-purple-700 font-bold">
                              #{c.orderNumber}
                            </div>
                            <div className="text-[11px] text-gray-600 truncate max-w-[140px]">
                              {c.storeName || 'Store'}
                            </div>
                          </td>

                          {/* Category & Subject */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md mb-0.5">
                              {CATEGORY_LABELS[c.category] || c.category}
                            </span>
                            <div className="font-semibold text-gray-900 truncate max-w-[200px]" title={c.subject}>
                              {c.subject}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <AdminStatusBadge status={c.status} size="sm" />
                          </td>

                          {/* Logged Date */}
                          <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                            {formatDate(c.createdAt)}
                          </td>

                          {/* Assigned Moderator */}
                          <td className="py-3.5 px-4">
                            {c.assignedAdminId ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                                <UserCheck className="w-3 h-3 text-purple-600" />
                                <span>{c.assignedAdminId.name || 'Admin'}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400 font-semibold italic">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenDossier(c._id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect Dossier</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Page {page} of {totalPages} ({totalComplaintsCount} Total Cases)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 font-bold"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 2: Transaction Exceptions (Real Cancelled / Failed Payment Orders) */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>Real Marketplace Transaction Exception Stream</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              These entries represent authentic NearExpiry platform transactions that encountered terminal exceptions (Order Cancelled or Payment Failed). They provide genuine context for dispute investigations.
            </p>
          </div>

          <AdminFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search exceptions by order number, customer, store, or cancellation reason..."
            filters={[
              {
                id: 'status',
                label: 'Exception Status',
                value: statusFilter,
                onChange: setStatusFilter,
                icon: Filter,
                options: [
                  { value: '', label: 'All Exceptions' },
                  { value: 'CANCELLED', label: 'Cancelled Orders' },
                ],
              },
            ]}
            totalResults={exceptionOrders.length}
            filteredCount={filteredExceptions.length}
            hasActiveFilters={hasActiveFilters}
            onClear={handleClearFilters}
          />

          {filteredExceptions.length === 0 ? (
            <AdminEmptyState
              icon={CheckCircle2}
              title="No Transaction Exceptions Found"
              description="No orders with cancellation or payment failure records match your criteria."
              actionLabel={hasActiveFilters ? 'Reset Filters' : undefined}
              actionIcon={hasActiveFilters ? RotateCcw : undefined}
              onAction={hasActiveFilters ? handleClearFilters : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filteredExceptions.map((order) => (
                <AdminMotionContainer
                  key={order._id}
                  hoverEffect
                  className="bg-white rounded-2xl border border-red-200/90 p-4 sm:p-5 shadow-sm space-y-3.5 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                        {order.orderNumber}
                      </span>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {formatDate(order.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <AdminStatusBadge status={order.paymentStatus} size="sm" label={`Pay: ${order.paymentStatus}`} />
                      <AdminStatusBadge status={order.status} size="sm" />
                    </div>
                  </div>

                  {/* Exception Description */}
                  <div className="bg-red-50/60 p-3 rounded-xl border border-red-100 text-xs space-y-1">
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                      Exception / Cancellation Record
                    </span>
                    <div className="font-semibold text-red-900">
                      Reason: {order.cancellation?.reason || 'No cancellation note recorded'}
                    </div>
                    {order.cancellation?.cancelledByRole && (
                      <div className="text-[11px] text-red-700">
                        Initiated by: <strong className="font-bold">{order.cancellation.cancelledByRole}</strong>
                        {order.cancellation.cancelledAt && ` at ${formatDate(order.cancellation.cancelledAt)}`}
                      </div>
                    )}
                  </div>

                  {/* Parties & Value */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Customer</span>
                      <span className="font-bold text-gray-900">{order.customerId?.name || 'Customer'}</span>
                      <span className="text-[11px] text-gray-500 block truncate">{order.customerId?.email}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Merchant Store</span>
                      <span className="font-bold text-purple-700">{order.storeId?.storeName || 'Store'}</span>
                      <span className="text-[11px] text-gray-500 block">{order.fulfillmentType}</span>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Disputed / Cancelled Total</span>
                      <span className="font-black text-gray-900 text-sm">
                        ₹{Number(order.pricingSummary?.finalTotal || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExceptionOrder(order);
                        setExceptionDrawerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Transaction Dossier</span>
                    </button>
                  </div>
                </AdminMotionContainer>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. Comprehensive Case Dossier Drawer */}
      <AdminDetailDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        width="max-w-4xl"
        eyebrow="PLATFORM RESOLUTION DOSSIER"
        title={
          activeComplaint
            ? `Case ${activeComplaint.complaintNumber}`
            : 'Complaint Investigation'
        }
        subtitle={
          activeComplaint
            ? `Order #${activeComplaint.orderNumber} • ${CATEGORY_LABELS[activeComplaint.category] || activeComplaint.category}`
            : 'Loading complaint context...'
        }
        footerActions={
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400">
              Audit-Logged Resolution Workspace
            </span>
            <button
              type="button"
              onClick={handleCloseDrawer}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition shadow"
            >
              Close Dossier
            </button>
          </div>
        }
      >
        {dossierLoading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <LoadingSpinner text="Retrieving multi-tier complaint telemetry and order ledger..." />
          </div>
        ) : dossierError ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-900 space-y-2">
            <div className="font-bold text-sm">Error Loading Case Dossier</div>
            <p className="text-xs">{dossierError}</p>
          </div>
        ) : activeComplaint ? (
          <div className="space-y-6 text-xs">
            {/* Quick Triage & Moderation Toolbar */}
            <div className="bg-gradient-to-r from-purple-50/60 to-indigo-50/60 p-4 rounded-2xl border border-purple-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <AdminStatusBadge status={activeComplaint.status} size="md" />
                  <AdminStatusBadge status={activeComplaint.priority} size="md" />
                  <span className="text-[11px] text-gray-500 font-semibold">
                    Filed on {formatDate(activeComplaint.createdAt)}
                  </span>
                </div>

                {/* Assign to Me Button */}
                <div className="flex items-center gap-2">
                  {activeComplaint.assignedAdminId?._id === user?._id ? (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Assigned to You</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={assigningAdmin}
                      onClick={handleAssignToMe}
                      className="px-3 py-1 bg-white hover:bg-purple-100 text-purple-700 border border-purple-300 font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50"
                    >
                      {assigningAdmin ? 'Assigning...' : 'Assign to Me'}
                    </button>
                  )}
                </div>
              </div>

              {/* Status and Priority Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-purple-100">
                {/* State Machine Transition */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Transition Lifecycle Status
                  </label>
                  {allowedTransitions.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        disabled={statusUpdating}
                        onChange={(e) => {
                          if (e.target.value) handleUpdateStatus(e.target.value);
                        }}
                        defaultValue=""
                        className="w-full bg-white border border-gray-300 text-gray-800 text-xs font-semibold rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-200"
                      >
                        <option value="" disabled>
                          Select Next Valid Transition...
                        </option>
                        {allowedTransitions.map((st) => (
                          <option key={st} value={st}>
                            Move to: {st.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg block">
                      Status is Finalized ({activeComplaint.status})
                    </span>
                  )}
                </div>

                {/* Priority Changer */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Adjust Priority Severity
                  </label>
                  <select
                    disabled={priorityUpdating}
                    value={activeComplaint.priority}
                    onChange={(e) => handleUpdatePriority(e.target.value)}
                    className="w-full bg-white border border-gray-300 text-gray-800 text-xs font-semibold rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-200"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">Critical Risk</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dossier Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2 overflow-x-auto">
              {[
                { id: 'overview', label: 'Case & Telemetry', icon: Eye },
                {
                  id: 'messages',
                  label: `Customer Dialogue (${publicMessages.length})`,
                  icon: MessageCircle,
                },
                {
                  id: 'notes',
                  label: `Internal Notes (${internalNotesList.length})`,
                  icon: Lock,
                },
                { id: 'timeline', label: 'Audit Timeline', icon: Clock },
                { id: 'settlement', label: 'Resolution Workspace', icon: Scale },
              ].map((tab) => {
                const IconComponent = tab.icon;
                const isActive = dossierTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDossierTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUB-PANEL 1: Case & Order Telemetry */}
            {dossierTab === 'overview' && (
              <div className="space-y-4">
                {/* Repeat Dispute Alert Banner (If same customer filed other complaints for this order) */}
                {dossierData?.relatedOrderComplaints?.length > 0 && (
                  <div className="bg-amber-50/90 border-2 border-amber-300 p-4 rounded-2xl shadow-xs space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <h4 className="font-extrabold text-amber-950 text-xs uppercase tracking-wider">
                            Repeat Dispute on Same Order Detected
                          </h4>
                          <p className="text-[11px] text-amber-800">
                            This customer has filed {dossierData.relatedOrderComplaints.length} other dispute(s) for Order #{activeComplaint.orderNumber}.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                        {dossierData.relatedOrderComplaints.length} Prior Case(s)
                      </span>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-amber-200/80">
                      {dossierData.relatedOrderComplaints.map((rc) => (
                        <div
                          key={rc._id}
                          className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-gray-900">
                                {rc.complaintNumber}
                              </span>
                              <AdminStatusBadge status={rc.status} size="sm" />
                              <span className="text-[10px] text-gray-400">
                                {formatDate(rc.createdAt)}
                              </span>
                            </div>
                            <div className="font-medium text-gray-800 truncate max-w-md">
                              {rc.subject}
                            </div>
                            {rc.resolution?.decision && (
                              <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5 flex-wrap">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Resolved: {rc.resolution.decision.replace(/_/g, ' ')}</span>
                                {rc.resolution.refundAmount > 0 && (
                                  <span className="font-mono text-emerald-700">
                                    (₹{Number(rc.resolution.refundAmount).toFixed(2)} Refunded)
                                  </span>
                                )}
                                {rc.resolution.notes && (
                                  <span className="italic text-gray-500 font-normal">
                                    — &ldquo;{rc.resolution.notes}&rdquo;
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenDossier(rc._id || rc.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-xs rounded-xl transition shadow-xs shrink-0 self-start sm:self-center cursor-pointer active:scale-95"
                          >
                            <span>Inspect Prior Case</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer Information Card */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-purple-600" />
                      <span>Customer Profile</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {dossierData?.customerDisputeCount > 1 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          {dossierData.customerDisputeCount} Total Platform Disputes
                        </span>
                      )}
                      {activeComplaint.customerId?.verificationStatus && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {activeComplaint.customerId.verificationStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase block">Full Name</span>
                      <span className="font-bold text-gray-900">{activeComplaint.customerId?.name || 'Customer'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase block">Email Address</span>
                      <span className="font-bold text-gray-900 truncate block">{activeComplaint.customerId?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase block">Phone</span>
                      <span className="font-bold text-gray-900">{activeComplaint.customerId?.phone || 'Not recorded'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase block">Total Dispute History</span>
                      <span className={`font-bold ${
                        (dossierData?.customerDisputeCount || 1) > 1 ? 'text-amber-700' : 'text-gray-900'
                      }`}>
                        {dossierData?.customerDisputeCount || 1} Total Case(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Associated Order & Fulfilling Store */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-purple-600" />
                      <span>Order &amp; Merchant Telemetry</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <AdminStatusBadge status={activeOrder?.status || 'UNKNOWN'} size="sm" />
                      <AdminStatusBadge status={activeOrder?.paymentStatus || 'UNKNOWN'} size="sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase block">Order Reference</span>
                      <span className="font-mono font-bold text-purple-700">#{activeComplaint.orderNumber}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase block">Merchant Store</span>
                      <span className="font-bold text-gray-900">{activeComplaint.storeName || activeOrder?.storeId?.storeName || 'Store'}</span>
                      <span className="text-[11px] text-gray-500 block">{activeOrder?.storeId?.address?.city || ''}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase block">Total Value Paid</span>
                      <span className="font-black text-gray-900 text-sm">
                        ₹{Number(activeOrder?.pricingSummary?.finalTotal || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Escrow Details */}
                  {activeOrder?.paymentId && (
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-gray-400">Transaction Ref: </span>
                        <span className="font-mono font-bold text-gray-800">
                          {activeOrder.paymentId.transactionReference || activeOrder.paymentId._id}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Method: </span>
                        <span className="font-bold text-gray-800">{activeOrder.paymentId.method || 'GATEWAY'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Affected Product & Batch Telemetry */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <span>Disputed Product &amp; Batch Telemetry</span>
                  </span>

                  {activeOrder?.items?.map((item) => {
                    const isDirectlyDisputed = activeComplaint.relatedItemId && String(item._id) === String(activeComplaint.relatedItemId);
                    const daysRemaining = calculateDaysRemaining(item.batchDetails?.expiryDate);
                    const isExpired = daysRemaining !== null && daysRemaining <= 0;

                    return (
                      <div
                        key={item._id}
                        className={`p-3 rounded-xl border transition ${
                          isDirectlyDisputed
                            ? 'bg-rose-50/70 border-rose-200'
                            : 'bg-gray-50/50 border-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{item.productName}</span>
                              {isDirectlyDisputed && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.2 rounded">
                                  Flagged in Claim
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Qty: {item.requestedQuantity} • Unit Price: ₹{item.discountedPrice} • Line Total: ₹{item.lineDiscountedAmount}
                            </div>
                          </div>
                          <span className="font-bold text-gray-900">
                            ₹{Number(item.lineDiscountedAmount || 0).toFixed(2)}
                          </span>
                        </div>

                        {/* Batch Details if available */}
                        {item.batchDetails && (
                          <div className="mt-2 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                            <div className="font-mono text-gray-600">
                              Batch #{item.batchDetails.batchNumber || 'N/A'}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">
                                Expiry: {formatDate(item.batchDetails.expiryDate)}
                              </span>
                              {daysRemaining !== null && (
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                    isExpired
                                      ? 'bg-red-100 text-red-800'
                                      : daysRemaining <= 3
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {isExpired ? 'EXPIRED' : `${daysRemaining} days left`}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Customer Claim & Statement */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Customer&apos;s Submitted Statement
                  </span>
                  <div className="font-bold text-gray-900 text-sm">{activeComplaint.subject}</div>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {activeComplaint.description}
                  </p>
                </div>

                {/* Customer Evidence Gallery */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Photographic Evidence ({activeComplaint.evidenceUrls?.length || 0})
                  </span>
                  {activeComplaint.evidenceUrls && activeComplaint.evidenceUrls.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {activeComplaint.evidenceUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-square flex items-center justify-center hover:opacity-90 transition"
                        >
                          <img
                            src={url}
                            alt={`Evidence ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement.innerText = 'Evidence Image';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold gap-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 italic py-1">
                      No visual or document evidence was uploaded by customer for this dispute.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SUB-PANEL 2: Public Customer Dialogue */}
            {dossierTab === 'messages' && (
              <div className="space-y-4">
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Messages in this tab are <strong>visible to the customer</strong> in their NearExpiry account. Use this to request photos, clarification, or notify them of updates.
                  </span>
                </div>

                {/* Message Thread */}
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {publicMessages.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      No public messages exchanged yet.
                    </div>
                  ) : (
                    publicMessages.map((msg, idx) => {
                      const isAdmin = msg.senderRole === 'ADMIN';
                      return (
                        <div
                          key={idx}
                          className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[85%] p-3 rounded-2xl text-xs space-y-1 ${
                              isAdmin
                                ? 'bg-purple-700 text-white rounded-tr-xs'
                                : 'bg-gray-100 text-gray-900 rounded-tl-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] font-bold opacity-80">
                              <span>{msg.senderName || msg.senderRole}</span>
                              <span>{formatDate(msg.createdAt)}</span>
                            </div>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Customer Response Composer */}
                <form onSubmit={handleSendCustomerMessage} className="pt-2 border-t border-gray-100 space-y-2">
                  <textarea
                    rows={3}
                    value={customerMessage}
                    onChange={(e) => setCustomerMessage(e.target.value)}
                    placeholder="Write a clear response to the customer..."
                    className="w-full p-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-purple-600 rounded-xl text-xs outline-none transition focus:ring-2 focus:ring-purple-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingCustomerMessage || !customerMessage.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingCustomerMessage ? 'Sending...' : 'Send to Customer'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUB-PANEL 3: Confidential Internal Notes */}
            {dossierTab === 'notes' && (
              <div className="space-y-4">
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Confidential Internal Notes:</strong> Hidden completely from customers and merchants. Visible only to NearExpiry platform administrators.
                  </span>
                </div>

                {/* Internal Notes Stream */}
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {internalNotesList.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      No internal operational notes recorded yet.
                    </div>
                  ) : (
                    internalNotesList.map((note, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-amber-50/40 rounded-2xl border border-amber-200/80 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-amber-900 font-bold">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-700" />
                            <span>{note.senderName || 'Admin'}</span>
                          </span>
                          <span>{formatDate(note.createdAt)}</span>
                        </div>
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{note.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Internal Note Composer */}
                <form onSubmit={handleAddInternalNote} className="pt-2 border-t border-gray-100 space-y-2">
                  <textarea
                    rows={3}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Record investigation notes, phone calls, or merchant escalation details..."
                    className="w-full p-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-amber-600 rounded-xl text-xs outline-none transition focus:ring-2 focus:ring-amber-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={addingInternalNote || !internalNote.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{addingInternalNote ? 'Saving...' : 'Record Private Note'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUB-PANEL 4: Audit & Action Timeline */}
            {dossierTab === 'timeline' && (
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Immutable Lifecycle Audit Trail
                </span>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {activeComplaint.timeline?.map((item, idx) => (
                    <div key={idx} className="relative">
                      <span className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                        item.isInternal ? 'bg-amber-500' : 'bg-purple-600'
                      }`} />
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-black text-gray-900 tracking-wider">
                            {item.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-gray-400 font-semibold">{formatDate(item.timestamp)}</span>
                        </div>
                        <div className="text-[11px] text-gray-700">
                          {item.notes || 'Action recorded'}
                        </div>
                        <div className="text-[10px] text-gray-400 font-semibold">
                          Actor: {item.performerName} ({item.performerRole})
                          {item.isInternal && ' • Private Log'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-PANEL 5: Resolution Workspace */}
            {dossierTab === 'settlement' && (
              <div className="space-y-4">
                {/* Check if already resolved */}
                {activeComplaint.status === 'RESOLVED' || activeComplaint.status === 'CLOSED' ? (
                  <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                        <h4 className="font-extrabold text-emerald-950 text-sm">
                          Case Finalized &amp; Settled
                        </h4>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full">
                        {activeComplaint.resolution?.decision || 'RESOLVED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-emerald-200/60">
                      <div>
                        <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                          Settlement Decision
                        </span>
                        <span className="font-bold text-gray-900">
                          {activeComplaint.resolution?.decision?.replace(/_/g, ' ') || 'Resolved'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                          Operational Action Taken
                        </span>
                        <span className="font-bold text-gray-900">
                          {activeComplaint.resolution?.actionRequested || 'NONE'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                          Action Execution Status
                        </span>
                        <span className="font-bold text-gray-900">
                          {activeComplaint.resolution?.actionExecutionStatus || 'COMPLETED'}
                        </span>
                      </div>
                      {activeComplaint.resolution?.refundId && (
                        <div>
                          <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                            Executed Refund ID
                          </span>
                          <span className="font-mono font-bold text-gray-900">
                            {activeComplaint.resolution.refundId}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs text-gray-800 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">
                        Admin Settlement Notes
                      </span>
                      <p className="leading-relaxed">{activeComplaint.resolution?.notes || 'No notes'}</p>
                    </div>

                    <div className="text-[10px] text-emerald-800 font-semibold">
                      Resolved on {formatDate(activeComplaint.resolvedAt)}
                    </div>
                  </div>
                ) : (
                  /* Active Resolution Form */
                  <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs space-y-4">
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                        <Scale className="w-4 h-4 text-purple-700" />
                        <span>Arbitrate Dispute &amp; Execute Settlement</span>
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Choose the binding marketplace resolution decision. Financial refunds and inventory restocks are never automatic; they require your explicit instruction.
                      </p>
                    </div>

                    {resolutionError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <span>{resolutionError}</span>
                      </div>
                    )}

                    {resolutionSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span>Dispute resolved successfully! Actions executed per instruction.</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Decision Choice */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                          1. Resolution Decision
                        </label>
                        <select
                          value={resolutionDecision}
                          onChange={(e) => setResolutionDecision(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200"
                        >
                          {RESOLUTION_DECISION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Operational Action Selector */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                          2. Operational Action to Execute
                        </label>
                        <select
                          value={actionRequested}
                          onChange={(e) => setActionRequested(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-200"
                        >
                          {RESOLUTION_ACTION_TYPES.map((act) => (
                            <option key={act.value} value={act.value}>
                              {act.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Refund Amount (if refund requested) */}
                      {(actionRequested === 'EXECUTE_REFUND' || actionRequested === 'BOTH') && (
                        <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200 space-y-1">
                          <label className="text-[10px] font-bold text-purple-900 uppercase block">
                            Refund Amount to Customer (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={refundAmount}
                              onChange={(e) => setRefundAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-200"
                            />
                          </div>
                          <div className="text-[10px] text-gray-500 pt-0.5">
                            Maximum refundable: ₹{Number(activeOrder?.pricingSummary?.finalTotal || 0).toFixed(2)}
                          </div>
                        </div>
                      )}

                      {/* Resolution Explanation */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 uppercase block mb-1">
                          3. Resolution Justification &amp; Notes <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Provide detailed reasoning for customer audit and internal accountability..."
                          className="w-full p-3 bg-gray-50 focus:bg-white border border-gray-300 rounded-xl text-xs outline-none transition focus:ring-2 focus:ring-purple-200"
                        />
                      </div>

                      {/* Submit Resolution Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setConfirmModalOpen(true)}
                          className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl transition shadow flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Review &amp; Execute Resolution Decision</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </AdminDetailDrawer>

      {/* 8. Safety Confirmation Modal */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">
                  Confirm Administrative Settlement
                </h3>
                <span className="text-xs text-gray-500">
                  Case #{activeComplaint?.complaintNumber}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Selected Decision:</span>
                <span className="font-bold text-gray-900">{resolutionDecision}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Action Type:</span>
                <span className="font-bold text-purple-700">{actionRequested}</span>
              </div>
              {actionRequested === 'EXECUTE_REFUND' || actionRequested === 'BOTH' ? (
                <div className="flex justify-between border-t border-gray-200 pt-2 text-rose-700 font-bold">
                  <span>Refund Initiated:</span>
                  <span>₹{Number(refundAmount || 0).toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between border-t border-gray-200 pt-2 text-gray-500">
                  <span>Financial Mutation:</span>
                  <span>None (No refund triggered)</span>
                </div>
              )}
              {actionRequested === 'EXECUTE_ORDER_CANCEL' || actionRequested === 'BOTH' ? (
                <div className="flex justify-between text-indigo-700 font-bold">
                  <span>Inventory Restoration:</span>
                  <span>Order will be CANCELLED &amp; batches restored</span>
                </div>
              ) : null}
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              <strong>Operational Disclaimer:</strong> Executing real refunds or cancellations communicates with live database records and payment gateways. This action cannot be reverted once processed.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={resolving}
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resolving}
                onClick={handleExecuteResolution}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl transition shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                {resolving ? 'Executing...' : 'Confirm & Execute Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Transaction Exception Order Detail Drawer */}
      <AdminDetailDrawer
        isOpen={exceptionDrawerOpen}
        onClose={() => setExceptionDrawerOpen(false)}
        eyebrow="TRANSACTION EXCEPTION DOSSIER"
        title={selectedExceptionOrder ? `Order #${selectedExceptionOrder.orderNumber}` : 'Order Detail'}
        subtitle={`Order ID: ${selectedExceptionOrder?._id || 'N/A'}`}
        footerActions={
          <div className="flex justify-end w-full">
            <button
              type="button"
              onClick={() => setExceptionDrawerOpen(false)}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition shadow"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedExceptionOrder && (
          <div className="space-y-4 text-xs">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Status Overview</span>
                <AdminStatusBadge status={selectedExceptionOrder.status} size="sm" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-gray-400 text-[10px] block">Order Number</span>
                  <span className="font-mono text-purple-700 font-bold">{selectedExceptionOrder.orderNumber}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block">Payment Status</span>
                  <AdminStatusBadge status={selectedExceptionOrder.paymentStatus} size="sm" />
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-red-900 space-y-2">
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                Cancellation &amp; Restock Investigation
              </span>
              <div className="text-sm font-bold">
                {selectedExceptionOrder.cancellation?.reason || 'No specific cancellation reason provided'}
              </div>
              <div className="text-[11px] text-red-800">
                Action by: {selectedExceptionOrder.cancellation?.cancelledByRole || 'User'} • Stock Restored: {selectedExceptionOrder.cancellation?.stockRestored ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Parties</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-400 text-[10px]">Customer</div>
                  <div className="font-bold text-gray-900">{selectedExceptionOrder.customerId?.name}</div>
                  <div className="text-[11px] text-gray-500">{selectedExceptionOrder.customerId?.email}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-[10px]">Merchant Store</div>
                  <div className="font-bold text-purple-700">{selectedExceptionOrder.storeId?.storeName}</div>
                  <div className="text-[11px] text-gray-500">{selectedExceptionOrder.fulfillmentType}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Associated Items ({selectedExceptionOrder.items?.length || 0})
              </span>
              <div className="divide-y divide-gray-100">
                {selectedExceptionOrder.items?.map((item) => (
                  <div key={item._id} className="py-2 flex justify-between">
                    <div>
                      <div className="font-bold text-gray-900">{item.productName}</div>
                      <div className="text-[11px] text-gray-400">Qty: {item.requestedQuantity}</div>
                    </div>
                    <div className="font-bold text-gray-900">
                      ₹{Number(item.lineDiscountedAmount || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex justify-between items-baseline">
              <span className="font-bold text-gray-700">Order Final Value:</span>
              <span className="text-lg font-black text-purple-700">
                ₹{Number(selectedExceptionOrder.pricingSummary?.finalTotal || 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </AdminDetailDrawer>
    </div>
  );
};

export default AdminSupportPage;
