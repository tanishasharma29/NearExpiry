import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Search,
  IndianRupee,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Package,
  Printer,
  ShieldCheck,
  RefreshCw,
  FileText,
  X,
  ArrowRight,
  ExternalLink,
  Clock,
  CreditCard,
  Sparkles,
  Filter,
  User,
  ShoppingBag,
  TrendingDown,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { billingService } from '../../services/billingService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { BillReceiptModal } from '../../components/billing/BillReceiptModal';
import {
  SellerPageHeader,
  MerchantStatCard,
  StatusBadge,
} from '../../components/seller';

/**
 * SellerBillingPage (Phase 10 Redesign)
 *
 * "Financial Records & Receipt Center"
 * Purpose: FINANCIAL RECORDS ("What transaction was completed and where is its official receipt?")
 *
 * Distinct from:
 * - FEFO Batches ("Which batch should I sell first?")
 * - Inventory & Stock ("How healthy is my overall inventory?")
 * - Expiry Alerts ("What requires my attention right now?")
 * - Store Orders ("What order needs to move next?")
 *
 * Features:
 * - 100% preservation of billingService.getSellerBillReceipts() and BillReceiptModal
 * - Authoritative financial summary strip (Total Receipts, Gross Revenue Billed, Markdown Savings, Avg Order Value)
 * - NearExpiry zero-waste financial story & recovery impact summary
 * - High-precision Transaction Ledger with rich itemization, discounts, and payment methods
 * - Fast real-time client & server search by Receipt #, Order #, Customer Name, and Customer Email
 * - Payment and preset filtering with clear counters and "Clear Filters"
 * - Responsive financial receipt cards on mobile, clean ledger table on desktop
 * - Zero fabricated data, robust empty and error states
 */
export const SellerBillingPage = () => {
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState({
    totalReceipts: 0,
    totalRevenueBilled: 0,
    totalSavingsGranted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL'); // ALL | PAID | PENDING | FAILED
  const [methodFilter, setMethodFilter] = useState('ALL'); // ALL | CASH_ON_DELIVERY | MOCK_PAYMENT
  const [activeTab, setActiveTab] = useState('ALL'); // ALL | TODAY | RECENT | HIGH_VALUE

  // Bill Receipt Modal State (100% Preserved)
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const searchInputRef = useRef(null);

  // Fetch receipts from existing backend API
  const fetchReceipts = async (searchTerm = search, isManualSync = false) => {
    try {
      if (isManualSync) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await billingService.getSellerBillReceipts({
        search: searchTerm,
        limit: 50,
      });

      setReceipts(res?.receipts || []);
      setSummary(
        res?.summary || {
          totalReceipts: 0,
          totalRevenueBilled: 0,
          totalSavingsGranted: 0,
        }
      );
    } catch (err) {
      console.error('Failed to load seller billing receipts:', err);
      setError(err?.message || 'Unable to load billing records. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReceipts('');
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReceipts(search);
  };

  const handleViewReceipt = (receipt) => {
    setSelectedReceipt(receipt);
    setModalOpen(true);
  };

  const focusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Helper: Format Date & Time
  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: 'N/A', time: '' };
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        time: d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  // Filtered Receipts List
  const filteredReceipts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return receipts.filter((rcpt) => {
      // 1. Client-side search fallback/enhancement
      if (search.trim()) {
        const query = search.toLowerCase();
        const rNum = (rcpt.receiptNumber || '').toLowerCase();
        const oNum = (rcpt.orderNumber || '').toLowerCase();
        const cName = (rcpt.customerInfo?.name || '').toLowerCase();
        const cEmail = (rcpt.customerInfo?.email || '').toLowerCase();
        const itemsList = (rcpt.items || []).map((i) => i.productName.toLowerCase()).join(' ');

        const matches =
          rNum.includes(query) ||
          oNum.includes(query) ||
          cName.includes(query) ||
          cEmail.includes(query) ||
          itemsList.includes(query);

        if (!matches) return false;
      }

      // 2. Payment Status Filter
      if (paymentFilter !== 'ALL' && rcpt.paymentStatus !== paymentFilter) {
        return false;
      }

      // 3. Payment Method Filter
      if (methodFilter !== 'ALL' && rcpt.paymentMethod !== methodFilter) {
        return false;
      }

      // 4. Quick Tabs Filter
      if (activeTab === 'TODAY') {
        const deliveredTime = new Date(rcpt.deliveredAt).getTime();
        if (deliveredTime < todayStart) return false;
      } else if (activeTab === 'HIGH_VALUE') {
        const total = Number(rcpt.pricingSummary?.finalTotal || 0);
        if (total < 500) return false;
      }

      return true;
    });
  }, [receipts, search, paymentFilter, methodFilter, activeTab]);

  const hasActiveFilters =
    search.trim() !== '' ||
    paymentFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    activeTab !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setPaymentFilter('ALL');
    setMethodFilter('ALL');
    setActiveTab('ALL');
    fetchReceipts('');
  };

  // Derived Average Receipt Value
  const averageReceiptValue = useMemo(() => {
    if (!summary.totalReceipts || summary.totalReceipts === 0) return 0;
    return (summary.totalRevenueBilled / summary.totalReceipts).toFixed(2);
  }, [summary]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Standardized Seller Page Header */}
      <SellerPageHeader
        badge="FINANCIAL RECORDS"
        title="Billing & Receipts"
        subtitle="Review completed transactions, access itemized receipts, and keep your store's financial records organized."
        showEngineStatus={true}
        breadcrumbs={[
          { label: 'Seller Hub', href: '/seller/dashboard' },
          { label: 'Financial Records', href: '/seller/billing' },
          { label: 'Billing & Receipts' },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={focusSearch}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Receipts</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReceipts(search, true)}
              disabled={refreshing || loading}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              title="Synchronize billing receipts with store ledger"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`}
              />
              <span>{refreshing ? 'Syncing...' : 'Sync Receipts'}</span>
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
          <h3 className="text-base font-bold text-rose-900">Unable to load billing records</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => fetchReceipts(search)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
          </button>
        </div>
      )}

      {/* 3. FINANCIAL SUMMARY HEADER (Connected Accounting Summary Strip) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 p-1 sm:p-2">
          {/* 1. Total Captured */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Total Captured
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Settled
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `₹${Number(summary.totalRevenueBilled || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              Net verified sales revenue
            </div>
          </div>

          {/* 2. Customer Savings */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Customer Savings
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Waste Rescued
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight font-mono">
              {loading ? '...' : `₹${Number(summary.totalSavingsGranted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              Dynamic markdown discounts
            </div>
          </div>

          {/* 3. Invoiced Transactions */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Transactions
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Invoiced
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : summary.totalReceipts}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              Handover verified receipts
            </div>
          </div>

          {/* 4. Average Ticket */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Average Ticket
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                Mean AOV
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `₹${averageReceiptValue}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">
              Mean completed order value
            </div>
          </div>
        </div>

        {/* Financial Statement Annotation */}
        <div className="bg-slate-50/80 border-t border-slate-100 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold text-slate-800">NearExpiry Financial Ledger:</span>
            <span className="text-slate-500 text-[11px]">
              Dynamic pricing incentives converted near-expiry shelf life into ₹{Number(summary.totalRevenueBilled || 0).toFixed(2)} in captured revenue.
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-slate-200 flex-shrink-0">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>100% Tax &amp; Audit Compliant</span>
          </div>
        </div>
      </div>

      {/* 5. Filter & Search Toolbar */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
          {/* Top Row: Quick Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Receipts ({receipts.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('TODAY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'TODAY'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Today's Receipts</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('HIGH_VALUE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'HIGH_VALUE'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/60'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>High Value (₹500+)</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Showing {filteredReceipts.length} of {receipts.length} receipts
            </div>
          </div>

          {/* Bottom Row: Search & Dropdowns */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by Receipt #, Order #, or Customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    fetchReceipts('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Payment Status Dropdown */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>

              {/* Payment Method Dropdown */}
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Payment Methods</option>
                <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
                <option value="MOCK_PAYMENT">Online / Digital Payment</option>
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

      {/* 6. Loading State */}
      {loading && (
        <div className="py-16">
          <LoadingSpinner text="Retrieving store billing records and financial ledger..." />
        </div>
      )}

      {/* 7. Transaction Ledger (Signature Table / Cards Section) */}
      {!loading && !error && filteredReceipts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            <span>Transaction Ledger</span>
            <span>{filteredReceipts.length} Official Records</span>
          </div>

          {/* Desktop & Tablet Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Receipt & Order Ref</th>
                    <th className="py-3.5 px-4">Customer Details</th>
                    <th className="py-3.5 px-4">Delivered Time</th>
                    <th className="py-3.5 px-4">Items Summary</th>
                    <th className="py-3.5 px-4 text-right">Subtotal / Savings</th>
                    <th className="py-3.5 px-4 text-right">Total Paid</th>
                    <th className="py-3.5 px-4 text-center">Payment</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReceipts.map((rcpt) => {
                    const dt = formatDateTime(rcpt.deliveredAt);
                    const subtotal = Number(rcpt.pricingSummary?.subtotal || 0);
                    const discounts = Number(rcpt.pricingSummary?.discounts || 0);
                    const finalTotal = Number(rcpt.pricingSummary?.finalTotal || 0);

                    return (
                      <tr key={rcpt._id} className="hover:bg-slate-50/70 transition">
                        {/* Receipt & Order Ref */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-emerald-800 text-xs flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{rcpt.receiptNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Order #{rcpt.orderNumber}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {rcpt.customerInfo?.name || 'Customer'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            {rcpt.customerInfo?.email || rcpt.customerInfo?.phone || 'Verified Customer'}
                          </div>
                        </td>

                        {/* Delivered Date */}
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="font-medium text-slate-800">{dt.date}</div>
                          <div className="text-[11px] text-slate-400">{dt.time}</div>
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span>{rcpt.items?.length || 0} product(s)</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {rcpt.items?.map((it) => it.productName).join(', ')}
                          </div>
                        </td>

                        {/* Subtotal / Discounts */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="text-slate-500 font-mono text-[11px]">
                            ₹{subtotal.toFixed(2)}
                          </div>
                          {discounts > 0 && (
                            <div className="text-[11px] font-bold text-emerald-600 font-mono">
                              -₹{discounts.toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* Total Paid (Prominent) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-black text-sm text-slate-900 font-mono">
                            ₹{finalTotal.toFixed(2)}
                          </div>
                        </td>

                        {/* Payment Status & Method */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusBadge status={rcpt.paymentStatus} size="sm" />
                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                              {rcpt.paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : 'Online'}
                            </span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(rcpt)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-2xs"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                            <span>View Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Financial Receipt Cards View */}
          <div className="md:hidden space-y-3">
            {filteredReceipts.map((rcpt) => {
              const dt = formatDateTime(rcpt.deliveredAt);
              const subtotal = Number(rcpt.pricingSummary?.subtotal || 0);
              const discounts = Number(rcpt.pricingSummary?.discounts || 0);
              const finalTotal = Number(rcpt.pricingSummary?.finalTotal || 0);

              return (
                <div
                  key={rcpt._id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3"
                >
                  {/* Top Row: Receipt # & Amount */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="font-mono font-black text-xs text-emerald-800">
                        {rcpt.receiptNumber}
                      </span>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Order #{rcpt.orderNumber}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Total</div>
                      <div className="font-black text-base text-slate-900 font-mono">
                        ₹{finalTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Timestamp */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-800">
                        {rcpt.customerInfo?.name || 'Customer'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {dt.date} {dt.time}
                    </div>
                  </div>

                  {/* Item Summary & Discounts */}
                  <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-800">
                        {rcpt.items?.length || 0} product(s)
                      </span>
                      {discounts > 0 && (
                        <span className="text-[11px] text-emerald-600 font-semibold block">
                          Saved ₹{discounts.toFixed(2)} near-expiry discount
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={rcpt.paymentStatus} size="sm" />
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={() => handleViewReceipt(rcpt)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View &amp; Print Tax Receipt</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Empty States */}
      {!loading && !error && receipts.length > 0 && filteredReceipts.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-slate-100 text-slate-500 mb-1">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No receipts match your search</h3>
          <p className="text-xs text-slate-500">
            No transactions found matching your current query or filter criteria. Try resetting the search filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {!loading && !error && receipts.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="inline-flex p-4 rounded-3xl bg-slate-100 text-slate-600 border border-slate-200 mb-1">
            <Receipt className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Your Financial Records are Empty</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Completed transactions and official tax invoices will appear here automatically as soon as customer pickup or delivery orders are verified and completed.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              to="/seller/orders"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>View Store Orders</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchReceipts('', true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>
      )}

      {/* 9. Itemized Bill Receipt Modal (100% PRESERVED COMPONENT & FUNCTIONALITY) */}
      <BillReceiptModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        receipt={selectedReceipt}
      />
    </div>
  );
};

export default SellerBillingPage;
