import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Printer, ArrowLeft, ShieldCheck, CheckCircle2, Download, AlertCircle } from 'lucide-react';
import { billingService } from '../../services/billingService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const OrderInvoicePage = () => {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const data = await billingService.getBillReceiptByOrderId(id);
        setReceipt(data?.receipt || data);
      } catch (err) {
        setError(err.message || 'Failed to load bill receipt. Make sure the order has been delivered.');
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [id]);

  if (loading) return <LoadingSpinner text="Loading official tax & delivery receipt..." />;

  if (error || !receipt) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Receipt Not Available Yet</h2>
        <p className="text-xs text-gray-500">{error || 'Bill receipt will be generated automatically once your order is picked up or delivered.'}</p>
        <Link
          to={`/orders/${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow transition hover:bg-emerald-700"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Order Details
        </Link>
      </div>
    );
  }

  const storeAddress =
    typeof receipt.storeInfo?.address === 'object'
      ? `${receipt.storeInfo.address.street || ''}, ${receipt.storeInfo.address.city || ''} ${receipt.storeInfo.address.pincode || ''}`
      : receipt.storeInfo?.address || 'Local Neighborhood Store';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Action Bar (hidden on print) */}
      <div className="flex justify-between items-center print:hidden">
        <Link
          to={`/orders/${receipt.orderId || id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-emerald-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Order Tracker
        </Link>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF Receipt
        </button>
      </div>

      {/* Official Tax Invoice Container */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">NearExpiry</h1>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Official Bill Receipt
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Sustainable Hyperlocal Rescue Marketplace</p>
          </div>

          <div className="sm:text-right space-y-0.5">
            <div className="font-mono font-bold text-emerald-700 text-sm">{receipt.receiptNumber}</div>
            <div className="text-xs text-gray-500 font-mono">Order: #{receipt.orderNumber}</div>
            <div className="text-xs text-gray-400">Delivered: {new Date(receipt.deliveredAt).toLocaleString()}</div>
          </div>
        </div>

        {/* Customer & Merchant Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Billed To:</span>
            <div className="font-bold text-gray-900 text-sm">{receipt.customerInfo?.name}</div>
            <div className="text-gray-600">{receipt.customerInfo?.email}</div>
            {receipt.customerInfo?.phone && <div className="text-gray-500">{receipt.customerInfo?.phone}</div>}
          </div>

          <div className="sm:text-right space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fulfilling Store:</span>
            <div className="font-bold text-gray-900 text-sm">{receipt.storeInfo?.storeName}</div>
            <div className="text-gray-600">{storeAddress}</div>
            <div className="text-gray-500">
              Verified by: <strong>{receipt.verifiedBy || 'Store Staff'}</strong>
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider grid grid-cols-12 gap-2 border-b border-gray-200">
            <span className="col-span-6">Item & FEFO Batch Lot</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-2 text-right">Catalog</span>
            <span className="col-span-2 text-right">Markdown</span>
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {receipt.items?.map((item, idx) => (
              <div key={idx} className="p-4 grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6 space-y-1">
                  <div className="font-bold text-gray-900 text-sm">{item.productName}</div>
                  {item.brand && <div className="text-xs text-gray-400">{item.brand}</div>}
                  {item.batchAllocations?.length > 0 && (
                    <div className="space-y-0.5 mt-1">
                      {item.batchAllocations.map((alloc, bIdx) => (
                        <div
                          key={bIdx}
                          className="font-mono text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block mr-1"
                        >
                          Lot {alloc.batchNumber} (Expires: {new Date(alloc.expiryDate).toLocaleDateString()}) - {alloc.allocatedQuantity} {item.unit || 'pcs'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-center font-bold text-gray-700">
                  {item.requestedQuantity}
                </div>
                <div className="col-span-2 text-right text-gray-400 line-through">
                  ₹{Number(item.lineOriginalAmount || 0).toFixed(2)}
                </div>
                <div className="col-span-2 text-right font-black text-gray-900 text-sm">
                  ₹{Number(item.lineDiscountedAmount || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="flex justify-end pt-2">
          <div className="w-full sm:w-80 space-y-2 text-xs bg-gray-50 p-5 rounded-2xl border border-gray-200">
            <div className="flex justify-between text-gray-600">
              <span>Catalog Subtotal:</span>
              <span className="font-semibold text-gray-900">
                ₹{Number(receipt.pricingSummary?.subtotal || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Near-Expiry Savings:</span>
              <span>-₹{Number(receipt.pricingSummary?.discounts || 0).toFixed(2)}</span>
            </div>
            {receipt.pricingSummary?.deliveryFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee:</span>
                <span>₹{Number(receipt.pricingSummary?.deliveryFee).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-200 flex justify-between text-base font-black text-gray-900">
              <span>Total Paid:</span>
              <span className="text-emerald-700">
                ₹{Number(receipt.pricingSummary?.finalTotal || 0).toFixed(2)}
              </span>
            </div>
            <div className="pt-1 text-[11px] text-gray-400 text-right">
              Method: <strong>{receipt.paymentMethod}</strong> • Status: <strong className="text-emerald-700">{receipt.paymentStatus}</strong>
            </div>
          </div>
        </div>

        {/* Verified Delivery Seal */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-400 gap-2">
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>NearExpiry Verified Atomic Delivery</span>
          </div>
          <span className="text-[11px]">Thank you for rescuing quality food and reducing landfill waste!</span>
        </div>
      </div>
    </div>
  );
};

export default OrderInvoicePage;

