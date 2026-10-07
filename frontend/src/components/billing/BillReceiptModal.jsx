import React from 'react';
import { Modal } from '../common/Modal';
import {
  Printer,
  Receipt,
  Store,
  User,
  Calendar,
  CheckCircle,
  Clock,
  ShieldCheck,
  Download,
} from 'lucide-react';

export const BillReceiptModal = ({ isOpen, onClose, receipt }) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeAddress =
    typeof receipt.storeInfo?.address === 'object'
      ? `${receipt.storeInfo.address.street || ''}, ${receipt.storeInfo.address.city || ''} ${receipt.storeInfo.address.pincode || ''}`
      : receipt.storeInfo?.address || 'Local Neighborhood Store';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tax Invoice & Bill Receipt" maxWidth="max-w-2xl">
      <div className="space-y-6 printable-receipt">
        {/* Receipt Header Badge */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-emerald-950 text-base">
                {receipt.receiptNumber}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                PAID & DELIVERED
              </span>
            </div>
            <p className="text-xs text-emerald-700 mt-0.5">
              Order Ref: <span className="font-mono font-bold">#{receipt.orderNumber}</span> • Handover Verified
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>

        {/* Customer & Store Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div>
            <span className="font-bold uppercase tracking-wider text-gray-400 text-[10px] block mb-1">
              Customer Details:
            </span>
            <div className="font-bold text-gray-900 text-sm">{receipt.customerInfo?.name}</div>
            <div className="text-gray-600">{receipt.customerInfo?.email}</div>
            {receipt.customerInfo?.phone && (
              <div className="text-gray-500 mt-0.5">{receipt.customerInfo?.phone}</div>
            )}
          </div>

          <div className="sm:text-right">
            <span className="font-bold uppercase tracking-wider text-gray-400 text-[10px] block mb-1">
              Store Merchant:
            </span>
            <div className="font-bold text-gray-900 text-sm">{receipt.storeInfo?.storeName}</div>
            <div className="text-gray-600">{storeAddress}</div>
            <div className="text-gray-500 mt-0.5">
              Verified by: <strong className="text-gray-800">{receipt.verifiedBy || 'Store Staff'}</strong>
            </div>
          </div>
        </div>

        {/* Itemized Product Breakdown Table */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="bg-gray-100 px-4 py-2.5 text-[11px] font-bold text-gray-600 uppercase tracking-wider grid grid-cols-12 gap-2">
            <span className="col-span-6">Item & Lot Allocation</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-2 text-right">Catalog</span>
            <span className="col-span-2 text-right">Markdown</span>
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {receipt.items?.map((item, idx) => (
              <div key={idx} className="p-3.5 grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6 space-y-1">
                  <div className="font-bold text-gray-900">{item.productName}</div>
                  {item.brand && <div className="text-[11px] text-gray-400">{item.brand}</div>}
                  {item.batchAllocations?.length > 0 && (
                    <div className="space-y-0.5 mt-1">
                      {item.batchAllocations.map((alloc, bIdx) => (
                        <div
                          key={bIdx}
                          className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block mr-1"
                        >
                          Lot {alloc.batchNumber} (Exp: {new Date(alloc.expiryDate).toLocaleDateString()}) - {alloc.allocatedQuantity} {item.unit || 'pcs'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-center font-bold text-gray-700">
                  {item.requestedQuantity} {item.unit || ''}
                </div>
                <div className="col-span-2 text-right text-gray-400 line-through">
                  ₹{Number(item.lineOriginalAmount || 0).toFixed(2)}
                </div>
                <div className="col-span-2 text-right font-black text-gray-900">
                  ₹{Number(item.lineDiscountedAmount || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1.5 text-xs bg-gray-50 p-4 rounded-2xl border border-gray-200">
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
            <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-black text-gray-900">
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

        {/* Security & Audit Footer */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Handover Seal
          </span>
          <span>Delivered: {new Date(receipt.deliveredAt).toLocaleString()}</span>
        </div>
      </div>
    </Modal>
  );
};

export default BillReceiptModal;

