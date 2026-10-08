import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  Store,
  X,
  XCircle,
} from 'lucide-react';
import { complaintService } from '../../services/complaintService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

const STATUS_CONFIG = {
  OPEN: {
    label: 'Open',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  WAITING_FOR_CUSTOMER: {
    label: 'Action Needed',
    color: 'bg-orange-100 text-orange-900 border-orange-300 font-black animate-pulse',
    dot: 'bg-orange-600',
  },
  WAITING_FOR_SELLER: {
    label: 'Waiting for Store',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  RESOLUTION_PENDING: {
    label: 'Resolution Pending',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
  },
  RESOLVED: {
    label: 'Resolved',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  CLOSED: {
    label: 'Closed',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
  },
  REJECTED: {
    label: 'Closed — Not Approved',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
  },
};

const CATEGORY_LABELS = {
  ORDER_NOT_RECEIVED: 'Order Not Received',
  WRONG_PRODUCT: 'Wrong Product',
  DAMAGED_PRODUCT: 'Damaged Product',
  EXPIRED_OR_UNSAFE_PRODUCT: 'Expired / Safety Concern',
  MISSING_ITEM: 'Missing Item',
  PAYMENT_PROBLEM: 'Payment Issue',
  REFUND_PROBLEM: 'Refund Issue',
  PICKUP_PROBLEM: 'Pickup Problem',
  DELIVERY_PROBLEM: 'Delivery Delay',
  PRODUCT_QUALITY: 'Quality / Spoilage',
  SELLER_DISPUTE: 'Store Dispute',
  OTHER: 'Other Issue',
};

const PRIORITY_BADGES = {
  LOW: 'text-gray-500 bg-gray-100',
  MEDIUM: 'text-blue-700 bg-blue-50',
  HIGH: 'text-amber-700 bg-amber-50',
  CRITICAL: 'text-rose-700 bg-rose-50 font-bold',
};

export const MyComplaintsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeParamId = searchParams.get('id');

  const [complaints, setComplaints] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const [selectedComplaintId, setSelectedComplaintId] = useState(activeParamId || null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Filtering
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Communication & Closure states
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  // Load complaints list
  const fetchComplaints = useCallback(async () => {
    try {
      setLoadingList(true);
      setListError('');
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const res = await complaintService.getComplaints(params);
      const list = res?.complaints || res?.data || (Array.isArray(res) ? res : []);
      setComplaints(list);

      // Auto-select first complaint if on desktop and none selected
      if (!selectedComplaintId && list.length > 0 && window.innerWidth >= 1024) {
        setSelectedComplaintId(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
      setListError(err.message || 'Unable to load support cases. Please try again.');
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, selectedComplaintId]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Load single complaint details
  const fetchComplaintDetails = useCallback(async (id) => {
    if (!id) {
      setSelectedComplaint(null);
      return;
    }
    try {
      setLoadingDetail(true);
      setDetailError('');
      const res = await complaintService.getComplaintById(id);
      setSelectedComplaint(res?.data || res);
    } catch (err) {
      console.error('Failed to load complaint details:', err);
      setDetailError(err.message || 'Failed to load case details.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedComplaintId) {
      fetchComplaintDetails(selectedComplaintId);
    }
  }, [selectedComplaintId, fetchComplaintDetails]);

  // Handle URL sync
  const handleSelectComplaint = (id) => {
    setSelectedComplaintId(id);
    setSearchParams(id ? { id } : {});
  };

  // Reply submission
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || replying || !selectedComplaintId) return;

    try {
      setReplying(true);
      setReplyError('');
      await complaintService.sendComplaintMessage(selectedComplaintId, {
        message: replyText.trim(),
      });
      setReplyText('');
      // Refresh detailed complaint thread and list state
      await fetchComplaintDetails(selectedComplaintId);
      await fetchComplaints();
    } catch (err) {
      console.error('Reply error:', err);
      setReplyError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setReplying(false);
    }
  };

  // Customer self-closure
  const handleCloseCase = async () => {
    if (!selectedComplaintId || closing) return;

    try {
      setClosing(true);
      await complaintService.closeComplaint(selectedComplaintId, 'Closed by customer');
      setCloseConfirmOpen(false);
      await fetchComplaintDetails(selectedComplaintId);
      await fetchComplaints();
    } catch (err) {
      console.error('Closure error:', err);
      alert(err.message || 'Failed to close complaint.');
    } finally {
      setClosing(false);
    }
  };

  // Filtered list
  const filteredComplaints = complaints.filter((c) => {
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = c.complaintNumber?.toLowerCase().includes(q);
      const matchSub = c.subject?.toLowerCase().includes(q);
      const matchOrd = c.orderNumber?.toLowerCase().includes(q);
      const matchStore = c.storeName?.toLowerCase().includes(q);
      if (!matchNum && !matchSub && !matchOrd && !matchStore) return false;
    }
    return true;
  });

  const canReply =
    selectedComplaint &&
    ![ 'CLOSED', 'REJECTED' ].includes(selectedComplaint.status);

  const canClose =
    selectedComplaint &&
    selectedComplaint.status === 'RESOLVED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Support & Complaints</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-brand-100 text-brand-800">
              Customer Helpdesk
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Track your submitted order disputes, communicate with our support team, and review resolutions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition shadow-xs"
          >
            <Package className="w-4 h-4 text-gray-500" />
            View Orders
          </Link>
          <button
            onClick={() => {
              fetchComplaints();
              if (selectedComplaintId) fetchComplaintDetails(selectedComplaintId);
            }}
            disabled={loadingList}
            className="p-2 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition shadow-xs"
            title="Refresh disputes"
          >
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace: Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================== */}
        {/* LEFT COLUMN: Complaints List & Filters (Hidden on Mobile if Detail selected) */}
        {/* ============================================================== */}
        <div
          className={`space-y-4 lg:col-span-5 ${
            selectedComplaintId ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Search case #, order, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 outline-none"
              >
                <option value="">All Statuses</option>
                {Object.keys(STATUS_CONFIG).map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-700 outline-none"
              >
                <option value="">All Categories</option>
                {Object.keys(CATEGORY_LABELS).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            {(statusFilter || categoryFilter || searchQuery) && (
              <div className="flex justify-between items-center text-[11px] pt-1">
                <span className="text-gray-500">
                  Showing {filteredComplaints.length} of {complaints.length} cases
                </span>
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setCategoryFilter('');
                    setSearchQuery('');
                  }}
                  className="text-brand-600 hover:underline font-bold"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>

          {/* List Content */}
          {loadingList ? (
            <div className="py-12 bg-white rounded-2xl border border-gray-200 text-center">
              <LoadingSpinner text="Retrieving your support cases..." />
            </div>
          ) : listError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 text-center space-y-2">
              <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />
              <p className="font-bold">{listError}</p>
              <button
                onClick={fetchComplaints}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold"
              >
                Retry
              </button>
            </div>
          ) : complaints.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <EmptyState
                icon={LifeBuoy}
                title="No support cases yet"
                description="Everything looks smooth! If you ever face an issue with an order, open the order and click 'Report an Issue'."
                actionLabel="View Past Orders"
                actionLink="/orders"
              />
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-xs text-gray-500 space-y-2">
              <p>No complaints match your active filter.</p>
              <button
                onClick={() => {
                  setStatusFilter('');
                  setCategoryFilter('');
                  setSearchQuery('');
                }}
                className="text-brand-600 font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredComplaints.map((item) => {
                const statusMeta = STATUS_CONFIG[item.status] || {
                  label: item.status,
                  color: 'bg-gray-100 text-gray-700',
                  dot: 'bg-gray-400',
                };
                const isSelected = selectedComplaintId === item._id;

                return (
                  <div
                    key={item._id}
                    onClick={() => handleSelectComplaint(item._id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-brand-50/40 border-brand-500 shadow-sm ring-1 ring-brand-500'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="font-mono font-bold text-xs text-gray-900">
                        {item.complaintNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-gray-900 line-clamp-1 mb-1">
                      {item.subject}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                      <span>Order #{item.orderNumber}</span>
                      <span>•</span>
                      <span>{item.storeName || 'Store'}</span>
                      <span>•</span>
                      <span className="text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Complaint Details & Conversation Thread */}
        {/* ============================================================== */}
        <div
          className={`space-y-6 lg:col-span-7 ${
            selectedComplaintId ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Mobile Back Button */}
          {selectedComplaintId && (
            <button
              onClick={() => handleSelectComplaint(null)}
              className="lg:hidden inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-xs mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all complaints
            </button>
          )}

          {!selectedComplaintId ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-12 text-center text-gray-400 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-sm font-bold text-gray-600">No case selected</p>
              <p className="text-xs text-gray-400">
                Select a dispute from the list to view investigation status and message thread.
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-16 text-center">
              <LoadingSpinner text="Loading case details..." />
            </div>
          ) : detailError ? (
            <div className="bg-white rounded-3xl border border-red-200 p-8 text-center text-xs space-y-2">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="font-bold text-red-700">{detailError}</p>
              <button
                onClick={() => fetchComplaintDetails(selectedComplaintId)}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl font-bold"
              >
                Retry
              </button>
            </div>
          ) : selectedComplaint ? (
            <div className="space-y-6">
              {/* 1. Case Header Dossier */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-gray-100">
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dispute Reference</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xl font-black font-mono text-gray-900">
                        {selectedComplaint.complaintNumber}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                          STATUS_CONFIG[selectedComplaint.status]?.color || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {STATUS_CONFIG[selectedComplaint.status]?.label || selectedComplaint.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canClose && (
                      <button
                        onClick={() => setCloseConfirmOpen(true)}
                        className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition transform active:scale-95"
                      >
                        Close Case
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Needed Banner for WAITING_FOR_CUSTOMER */}
                {selectedComplaint.status === 'WAITING_FOR_CUSTOMER' && (
                  <div className="p-4 bg-orange-50 border border-orange-300 rounded-2xl flex items-start gap-3 text-orange-950 text-xs shadow-xs animate-fade-in">
                    <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-black text-orange-900">Information Requested by Support Team</p>
                      <p className="text-orange-800 text-[11px]">
                        Our team has sent a message asking for clarification. Please review the conversation below and reply to proceed with the resolution.
                      </p>
                    </div>
                  </div>
                )}

                {/* Target Subject & Category metadata */}
                <div className="space-y-2">
                  <h2 className="text-base font-bold text-gray-900">{selectedComplaint.subject}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 font-semibold">
                      {CATEGORY_LABELS[selectedComplaint.category] || selectedComplaint.category}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        PRIORITY_BADGES[selectedComplaint.priority] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Priority: {selectedComplaint.priority}
                    </span>
                    <span className="text-gray-400">
                      Filed on {new Date(selectedComplaint.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Related Order Context Card */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Related Order</span>
                    <div className="font-mono font-bold text-gray-900">#{selectedComplaint.orderNumber}</div>
                    <div className="text-gray-600 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-gray-400" />
                      <span>{selectedComplaint.storeName || 'NearExpiry Store'}</span>
                    </div>
                  </div>
                  <Link
                    to={`/orders/${selectedComplaint.orderId}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-xl border border-gray-200 transition text-[11px] self-start sm:self-center"
                  >
                    <span>View Order Details</span>
                    <ExternalLink className="w-3 h-3 text-gray-500" />
                  </Link>
                </div>

                {/* Original Description */}
                <div className="space-y-1.5 text-xs">
                  <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Original Issue Description</span>
                  <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-2xl text-gray-800 leading-relaxed whitespace-pre-line">
                    {selectedComplaint.description}
                  </div>
                </div>

                {/* Evidence Attachments */}
                {selectedComplaint.evidenceUrls?.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">Customer Evidence</span>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedComplaint.evidenceUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs"
                          title="Click to view full image"
                        >
                          <img
                            src={url}
                            alt={`Evidence ${idx + 1}`}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement.classList.add('flex', 'items-center', 'justify-center');
                              e.currentTarget.parentElement.innerHTML = '<span class="text-[10px] text-gray-400 text-center p-1 font-mono">Image link broken</span>';
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Official Resolution Dossier (If Concluded) */}
              {selectedComplaint.resolution?.decision && (
                <div className="bg-emerald-50/70 border border-emerald-200 p-6 rounded-3xl shadow-sm space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-sm text-emerald-950 uppercase tracking-wider">Official Case Resolution</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-4 rounded-2xl border border-emerald-100">
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Decision:</span>
                      <div className="font-bold text-emerald-900 text-sm mt-0.5">
                        {selectedComplaint.resolution.decision.replace(/_/g, ' ')}
                      </div>
                    </div>
                    {selectedComplaint.resolution.refundAmount > 0 && (
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[10px]">Refund Processed:</span>
                        <div className="font-bold text-emerald-800 text-sm mt-0.5 font-mono">
                          ₹{Number(selectedComplaint.resolution.refundAmount).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedComplaint.resolution.notes && (
                    <div className="text-xs text-emerald-900 bg-white p-4 rounded-2xl border border-emerald-100 leading-relaxed">
                      <span className="font-bold block text-gray-500 uppercase text-[10px] mb-1">Resolution Summary:</span>
                      {selectedComplaint.resolution.notes}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Investigation Timeline */}
              {selectedComplaint.timeline?.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-600" />
                    <h3 className="text-sm font-bold text-gray-900">Case Timeline</h3>
                  </div>

                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {selectedComplaint.timeline.map((evt, idx) => (
                      <div key={idx} className="relative text-xs space-y-0.5">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">
                            {evt.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {evt.notes && <p className="text-gray-600 text-[11px] leading-relaxed">{evt.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Support Conversation Thread */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-brand-600" />
                    <h3 className="text-sm font-bold text-gray-900">Support Conversation</h3>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {selectedComplaint.messages?.length || 0} message(s)
                  </span>
                </div>

                {/* Message Bubbles */}
                <div className="space-y-3 max-h-96 overflow-y-auto p-1">
                  {selectedComplaint.messages?.map((msg, idx) => {
                    const isUser = msg.senderRole === 'CUSTOMER';

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400">
                          <span className="font-bold text-gray-700">
                            {isUser ? 'You' : 'NearExpiry Support Team'}
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line shadow-xs ${
                            isUser
                              ? 'bg-brand-600 text-white rounded-br-xs'
                              : 'bg-gray-100 text-gray-900 rounded-bl-xs border border-gray-200'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Form */}
                {canReply ? (
                  <form onSubmit={handleSendReply} className="pt-3 border-t border-gray-100 space-y-2">
                    {replyError && (
                      <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{replyError}</span>
                      </div>
                    )}
                    <div className="relative">
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Reply to the support team..."
                        className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none leading-relaxed"
                      />
                      <div className="absolute right-2.5 bottom-2.5 text-[10px] text-gray-400">
                        {replyText.length}/2000
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={replying || !replyText.trim()}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 active:scale-95"
                      >
                        {replying ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Message</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500">
                    This case is {selectedComplaint.status.toLowerCase()}. Conversation thread is closed.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Confirmation Modal for Closing Case */}
      {closeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-fade-in">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-gray-900 text-base">Close this support case?</h3>
              <p className="text-xs text-gray-500">
                Are you satisfied with the resolution? Closing will mark the case as finalized.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCloseConfirmOpen(false)}
                className="flex-1 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Keep Open
              </button>
              <button
                onClick={handleCloseCase}
                disabled={closing}
                className="flex-1 py-2 text-xs font-bold text-white bg-gray-900 hover:bg-black rounded-xl transition flex items-center justify-center gap-1.5"
              >
                {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, Close Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyComplaintsPage;

