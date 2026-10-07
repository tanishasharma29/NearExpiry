import React, { useEffect, useState } from 'react';
import {
  Receipt,
  Search,
  IndianRupee,
  Calendar,
  CheckCircle,
  Package,
  Printer,
  ShieldCheck,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { billingService } from '../../services/billingService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { BillReceiptModal } from '../../components/billing/BillReceiptModal';

export const SellerBillingPage = () => {
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState({
    totalReceipts: 0,
    totalRevenueBilled: 0,
    totalSavingsGranted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchReceipts = async (searchTerm = search) => {
    try {
      setLoading(true);
      const res = await billingService.getSellerBillReceipts({ search: searchTerm });
      setReceipts(res?.receipts || []);
      setSummary(res?.summary || { totalReceipts: 0, totalRevenueBilled: 0, totalSavingsGranted: 0 });
    } catch (err) {
      console.error('Failed to load seller billing receipts:', err);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Store Billing & Receipts</h1>
          <p className="text-xs text-gray-500 mt-1">
            Track and print itemized customer billing receipts, lot deductions, and revenue audit trails
          </p>
        </div>

        <button
          onClick={() => fetchReceipts(search)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          Refresh Receipts
        </button>
      </div>

      {/* Summary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Billed Receipts</span>
            <Receipt className="w-4 h-4 text-brand-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{summary.totalReceipts}</div>
          <p className="text-[11px] text-gray-400">Delivered & verified customer orders</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue Billed</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            ₹{Number(summary.totalRevenueBilled || 0).toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-400">Captured through store pickups & deliveries</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiry Markdown Given</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            ₹{Number(summary.totalSavingsGranted || 0).toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-400">Direct consumer food waste markdown savings</p>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Receipt #, Order #, or Customer Name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-brand-500 shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
        >
          Search
        </button>
      </form>

      {/* Receipts Table */}
      {loading ? (
        <LoadingSpinner text="Retrieving store billing records..." />
      ) : receipts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-400 text-xs">
          No billing receipts found matching your criteria. Receipts are automatically generated when pickup orders are verified.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Receipt & Order Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Delivered Time</th>
                  <th className="py-3 px-4">Items / Allocations</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {receipts.map((rcpt) => (
                  <tr key={rcpt._id} className="hover:bg-gray-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-emerald-800">{rcpt.receiptNumber}</div>
                      <div className="text-[11px] text-gray-400 font-mono">#{rcpt.orderNumber}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900">{rcpt.customerInfo?.name || 'Customer'}</div>
                      <div className="text-[11px] text-gray-400">{rcpt.customerInfo?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      <div>{new Date(rcpt.deliveredAt).toLocaleDateString()}</div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(rcpt.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">
                        {rcpt.items?.length || 0} product(s)
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-[200px]">
                        {rcpt.items?.map((it) => it.productName).join(', ')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-black text-gray-900">
                        ₹{Number(rcpt.pricingSummary?.finalTotal || 0).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold uppercase">
                        {rcpt.paymentMethod}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleViewReceipt(rcpt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-lg text-xs transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Bill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bill Receipt Modal View */}
      <BillReceiptModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        receipt={selectedReceipt}
      />
    </div>
  );
};

export default SellerBillingPage;

