import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Send,
  User,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';
import { complaintService } from '../../services/complaintService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const STATUS_TABS = [
  { key: 'ALL', label: 'All Disputes' },
  { key: 'OPEN', label: 'Open' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'WAITING_FOR_SELLER', label: 'Action Required' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

const CATEGORY_NAMES = {
  ORDER_NOT_RECEIVED: 'Order Not Received',
  WRONG_PRODUCT: 'Wrong Product',
  DAMAGED_PRODUCT: 'Damaged Product',
  EXPIRED_OR_UNSAFE_PRODUCT: 'Expired/Unsafe Product',
  MISSING_ITEM: 'Missing Item',
  PAYMENT_PROBLEM: 'Payment Problem',
  REFUND_PROBLEM: 'Refund Issue',
  PICKUP_PROBLEM: 'Pickup Problem',
  DELIVERY_PROBLEM: 'Delivery Issue',
  PRODUCT_QUALITY: 'Product Quality',
  SELLER_DISPUTE: 'Seller Dispute',
  OTHER: 'Other',
};

export const SellerComplaintsPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [storeDetails, setStoreDetails] = useState(null);
  const [searchParams] = useSearchParams();
  const deepLinkComplaintId = searchParams.get('complaintId');

  // Active Dispute Modal / Drawer
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeChatTab, setActiveChatTab] = useState('CUSTOMER'); // 'CUSTOMER' | 'ADMIN'
  const [replyMessage, setReplyMessage] = useState('');
  const [adminReplyMessage, setAdminReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState(null);

  // Resolution Form Modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionDecision, setResolutionDecision] = useState('RESOLVED_WITH_EXPLANATION');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  const fetchComplaints = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await complaintService.getSellerComplaints(params);
      const data = res?.data || res;
      setComplaints(data?.complaints || []);
      if (data?.storeDetails) {
        setStoreDetails(data.storeDetails);
      }
    } catch (err) {
      console.error('Failed to load seller disputes:', err);
      setError(err?.response?.data?.message || 'Unable to retrieve disputes for your store.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleOpenComplaint = async (complaintId) => {
    try {
      setDetailLoading(true);
      setReplyError(null);
      const res = await complaintService.getSellerComplaintById(complaintId);
      const data = res?.data || res;
      setSelectedComplaint(data);
    } catch (err) {
      console.error('Failed to open complaint details:', err);
      alert(err?.response?.data?.message || 'Failed to open complaint details.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (deepLinkComplaintId) {
      handleOpenComplaint(deepLinkComplaintId);
    }
  }, [deepLinkComplaintId]);

  const handleSendReply = async (e, channel = 'CUSTOMER_SELLER') => {
    e.preventDefault();
    const textToSend = channel === 'ADMIN_SELLER' ? adminReplyMessage.trim() : replyMessage.trim();
    if (!textToSend || !selectedComplaint) return;

    try {
      setSendingReply(true);
      setReplyError(null);
      const res = await complaintService.sendSellerComplaintMessage(selectedComplaint._id, {
        message: textToSend,
        channel,
      });
      const updated = res?.data || res;
      setSelectedComplaint(updated);
      if (channel === 'ADMIN_SELLER') {
        setAdminReplyMessage('');
      } else {
        setReplyMessage('');
      }
      fetchComplaints();
    } catch (err) {
      console.error('Failed to send merchant response:', err);
      setReplyError(err?.response?.data?.message || 'Failed to deliver message.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleResolveComplaint = async (e) => {
    e.preventDefault();
    if (!resolutionNotes.trim() || !selectedComplaint) return;

    try {
      setResolving(true);
      setResolveError(null);
      const res = await complaintService.resolveSellerComplaint(selectedComplaint._id, {
        decision: resolutionDecision,
        notes: resolutionNotes.trim(),
      });
      const updated = res?.data || res;
      setSelectedComplaint(updated);
      setShowResolveModal(false);
      setResolutionNotes('');
      fetchComplaints();
    } catch (err) {
      console.error('Failed to record resolution:', err);
      setResolveError(err?.response?.data?.message || 'Failed to record dispute resolution.');
    } finally {
      setResolving(false);
    }
  };

  // KPIs
  const totalCount = complaints.length;
  const activeCount = complaints.filter((c) =>
    ['OPEN', 'UNDER_REVIEW', 'WAITING_FOR_SELLER'].includes(c.status)
  ).length;
  const resolvedCount = complaints.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status)).length;
  const criticalCount = complaints.filter((c) => c.priority === 'CRITICAL' || c.priority === 'HIGH').length;

  const isStoreSuspended = storeDetails && (!storeDetails.isActive || storeDetails.verificationStatus === 'SUSPENDED');

  return (
    <div className="space-y-6">
      {/* Top Banner / Store Status Warning */}
      {isStoreSuspended && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-900">Your Store is Currently Suspended by Administration</h4>
            <p className="text-xs text-red-700">
              Your store has been temporarily suspended from accepting new orders. Please address and resolve any pending
              customer disputes below to restore your store&apos;s active status.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900">Customer Disputes &amp; Complaints</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              Merchant Hub
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Communicate directly with customers to resolve order disputes, avoid escalations, and protect your store rating.
          </p>
        </div>

        <button
          onClick={fetchComplaints}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Disputes</span>
            <div className="text-2xl font-black text-gray-900 mt-1">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Active / Action Needed</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{activeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Resolved Cases</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">High / Critical</span>
            <div className="text-2xl font-black text-rose-600 mt-1">{criticalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 p-1 bg-gray-50 border border-gray-100 rounded-xl w-full md:w-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === tab.key
                    ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Dispute #, Order #..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 focus:bg-white border border-gray-200 focus:border-brand-500 rounded-xl text-xs outline-none transition"
            />
          </div>
        </div>

        {/* Complaints List */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner message="Loading customer disputes..." />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12 text-gray-400 space-y-2">
            <MessageSquare className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-bold text-gray-700">No disputes found</p>
            <p className="text-xs text-gray-400">
              {statusFilter === 'ALL'
                ? 'Your store has a clean slate with zero customer complaints.'
                : 'No disputes matching the selected status filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {complaints.map((c) => {
              const isOpen = ['OPEN', 'UNDER_REVIEW', 'WAITING_FOR_SELLER'].includes(c.status);
              const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';

              return (
                <div
                  key={c._id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 p-2 rounded-xl transition"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs text-gray-900">#{c.complaintNumber}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                        Order #{c.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOpen
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : isResolved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {c.status.replace(/_/g, ' ')}
                      </span>
                      {c.priority === 'CRITICAL' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          CRITICAL
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-gray-900">{c.subject}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span>Category: {CATEGORY_NAMES[c.category] || c.category}</span>
                      {c.customerId?.name && (
                        <span>Customer: <strong className="text-gray-700">{c.customerId.name}</strong></span>
                      )}
                      <span>
                        Filed: {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span>Messages: {c.messages?.length || 0}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenComplaint(c._id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition shadow-xs"
                    >
                      <span>Talk with Customer</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dispute Dialogue Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-gray-900">#{selectedComplaint.complaintNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                    Order #{selectedComplaint.orderNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedComplaint.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedComplaint.status}
                  </span>
                </div>
                <h2 className="text-base font-bold text-gray-900 mt-1">{selectedComplaint.subject}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>Category: {CATEGORY_NAMES[selectedComplaint.category] || selectedComplaint.category}</span>
                  {selectedComplaint.customerId?.name && (
                    <span>Customer: <strong className="text-gray-800">{selectedComplaint.customerId.name}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedComplaint.status !== 'RESOLVED' && selectedComplaint.status !== 'CLOSED' && (
                  <button
                    onClick={() => setShowResolveModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolve Dispute</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Conversation Stream */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Order Context Card */}
              {selectedComplaint.orderDetails && (
                <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-purple-600" />
                    <span>
                      Order Value: <strong>₹{Number(selectedComplaint.orderDetails.pricingSummary?.finalTotal || 0).toFixed(2)}</strong>
                    </span>
                    <span>• Status: <strong>{selectedComplaint.orderDetails.status}</strong></span>
                  </div>
                  <span className="font-mono text-purple-700 font-bold">
                    Ref: {selectedComplaint.orderDetails.paymentId?.transactionReference || 'N/A'}
                  </span>
                </div>
              )}

              {/* Resolution Banner if resolved */}
              {selectedComplaint.resolution?.resolvedAt && (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resolved by {selectedComplaint.resolution.resolvedByName || 'Merchant'}</span>
                  </div>
                  <p className="text-emerald-800">{selectedComplaint.resolution.notes}</p>
                </div>
              )}

              {/* Communication Channel Tabs */}
              {(() => {
                const customerMessages = (selectedComplaint.messages || []).filter(
                  (m) =>
                    m.channel === 'CUSTOMER_SELLER' ||
                    (!m.channel &&
                      m.senderRole !== 'ADMIN' &&
                      m.recipientRole !== 'SELLER' &&
                      m.recipientRole !== 'ADMIN')
                );

                const adminMessages = (selectedComplaint.messages || []).filter(
                  (m) =>
                    m.channel === 'ADMIN_SELLER' ||
                    (!m.channel &&
                      (m.senderRole === 'ADMIN' ||
                        m.recipientRole === 'SELLER' ||
                        m.recipientRole === 'ADMIN'))
                );

                return (
                  <>
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                      <button
                        type="button"
                        onClick={() => setActiveChatTab('CUSTOMER')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          activeChatTab === 'CUSTOMER'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Customer Chat ({customerMessages.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveChatTab('ADMIN')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                          activeChatTab === 'ADMIN'
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Admin Chat ({adminMessages.length})</span>
                        {adminMessages.length > 0 && activeChatTab !== 'ADMIN' && (
                          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        )}
                      </button>
                    </div>

                    {/* SECTION 1: Customer Chat */}
                    {activeChatTab === 'CUSTOMER' && (
                      <div className="space-y-3">
                        <div className="space-y-3 min-h-[160px] max-h-[300px] overflow-y-auto pr-1">
                          {customerMessages.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 italic text-xs">
                              No customer dialogue exchanged yet.
                            </div>
                          ) : (
                            customerMessages.map((msg, idx) => {
                              const isSeller = msg.senderRole === 'SELLER';
                              return (
                                <div
                                  key={idx}
                                  className={`flex flex-col ${isSeller ? 'items-end' : 'items-start'}`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-gray-400 font-bold">
                                    <span className={isSeller ? 'text-emerald-700' : 'text-blue-700'}>
                                      {isSeller
                                        ? 'You (Merchant)'
                                        : `Customer (${msg.senderName || 'Customer'})`}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      {new Date(msg.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>

                                  <div
                                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                                      isSeller
                                        ? 'bg-emerald-600 text-white rounded-br-xs'
                                        : 'bg-gray-100 text-gray-900 rounded-bl-xs border border-gray-200'
                                    }`}
                                  >
                                    {msg.message}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: Admin Chat */}
                    {activeChatTab === 'ADMIN' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 text-xs text-purple-950 flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-bold">Private Platform Support & Admin Channel</p>
                            <p className="text-[11px] text-purple-800 leading-relaxed">
                              This conversation is strictly private between your store and NearExpiry
                              Administrators. <strong>Customers cannot see this chat.</strong>
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 min-h-[160px] max-h-[300px] overflow-y-auto pr-1">
                          {adminMessages.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 italic text-xs">
                              No private messages with Platform Admin yet.
                            </div>
                          ) : (
                            adminMessages.map((msg, idx) => {
                              const isSeller = msg.senderRole === 'SELLER';
                              return (
                                <div
                                  key={idx}
                                  className={`flex flex-col ${isSeller ? 'items-end' : 'items-start'}`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-gray-400 font-bold">
                                    <span className={isSeller ? 'text-emerald-700' : 'text-purple-700'}>
                                      {isSeller
                                        ? 'You (Merchant)'
                                        : `🛡️ Platform Support Admin (${msg.senderName || 'Admin'})`}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      {new Date(msg.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>

                                  <div
                                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                                      isSeller
                                        ? 'bg-emerald-600 text-white rounded-br-xs'
                                        : 'bg-purple-50 text-purple-950 border border-purple-200 rounded-bl-xs font-medium'
                                    }`}
                                  >
                                    {msg.message}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Reply Composer */}
            {selectedComplaint.status !== 'CLOSED' && selectedComplaint.status !== 'REJECTED' && (
              <form
                onSubmit={(e) =>
                  handleSendReply(e, activeChatTab === 'ADMIN' ? 'ADMIN_SELLER' : 'CUSTOMER_SELLER')
                }
                className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-2"
              >
                {replyError && (
                  <div className="p-2 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{replyError}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeChatTab === 'ADMIN' ? adminReplyMessage : replyMessage}
                    onChange={(e) =>
                      activeChatTab === 'ADMIN'
                        ? setAdminReplyMessage(e.target.value)
                        : setReplyMessage(e.target.value)
                    }
                    placeholder={
                      activeChatTab === 'ADMIN'
                        ? 'Write a private message or update to Platform Admin...'
                        : 'Write a response to the customer regarding their dispute...'
                    }
                    disabled={sendingReply}
                    className="flex-1 px-4 py-2.5 bg-white border border-gray-200 focus:border-brand-500 rounded-xl text-xs outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={
                      sendingReply ||
                      (activeChatTab === 'ADMIN' ? !adminReplyMessage.trim() : !replyMessage.trim())
                    }
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50 ${
                      activeChatTab === 'ADMIN'
                        ? 'bg-purple-700 hover:bg-purple-800'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {sendingReply
                        ? 'Sending...'
                        : activeChatTab === 'ADMIN'
                        ? 'Send to Admin'
                        : 'Send to Customer'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Resolution Confirmation Modal */}
      {showResolveModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zIndex: 70 }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-gray-900">Resolve Customer Dispute</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Mark this complaint as resolved after agreeing with the customer. Both the customer and platform admin
              will be notified of your resolution explanation.
            </p>

            <form onSubmit={handleResolveComplaint} className="space-y-3">
              {resolveError && (
                <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Resolution Decision
                </label>
                <select
                  value={resolutionDecision}
                  onChange={(e) => setResolutionDecision(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none"
                >
                  <option value="RESOLVED_WITH_EXPLANATION">Resolved with Customer Agreement &amp; Explanation</option>
                  <option value="REPLACEMENT_APPROVED">Replacement / Missing Item Handed Over</option>
                  <option value="STORE_CREDIT">Store Credit / Goodwill Concession</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Explanation / Resolution Notes *
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail the agreed solution (e.g. fresh item delivered, customer verified replacement at counter)..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving || !resolutionNotes.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {resolving ? 'Recording...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerComplaintsPage;

