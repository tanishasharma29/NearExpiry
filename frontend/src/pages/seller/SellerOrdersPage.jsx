import React, { useEffect, useState, useRef } from 'react';
import {
  ShoppingBag,
  CheckCircle,
  Package,
  Truck,
  Store,
  IndianRupee,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  KeyRound,
  User,
  Calendar,
  Receipt,
  FileText,
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { billingService } from '../../services/billingService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { BillReceiptModal } from '../../components/billing/BillReceiptModal';

const NEXT_STATUS_MAP = {
  CONFIRMED: 'PACKED',
  PACKED: 'READY_FOR_PICKUP',
  READY_FOR_PICKUP: 'DELIVERED',
};

export const SellerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL'); // ALL | PICKUP | LOCAL_DELIVERY

  // QR Scanner & Verification State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'manual'
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [scanError, setScanError] = useState('');

  // Bill Receipt View State
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const handleOpenReceipt = async (orderId) => {
    try {
      const data = await billingService.getBillReceiptByOrderId(orderId);
      setSelectedReceipt(data?.receipt || data);
      setReceiptModalOpen(true);
    } catch (err) {
      console.error('Failed to load bill receipt:', err);
    }
  };

  const scannerRef = useRef(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await orderService.getSellerOrders();
      setOrders(data?.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Initialize html5-qrcode scanner when scanner modal opens in camera mode
  useEffect(() => {
    if (!scannerOpen || scanMode !== 'camera' || verificationResult) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    // Small delay to ensure modal DOM container is mounted
    const timer = setTimeout(() => {
      const container = document.getElementById('pickup-qr-reader');
      if (!container) return;

      try {
        const scanner = new Html5QrcodeScanner(
          'pickup-qr-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scanner.render(
          (decodedText) => {
            // Stop scanning and verify token
            scanner.clear().catch(() => {});
            scannerRef.current = null;
            handleVerifyToken(decodedText);
          },
          (errorMessage) => {
            // Frame scan failures are continuous and safe to ignore
          }
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error('Failed to initialize camera scanner:', err);
        setScanMode('manual');
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scannerOpen, scanMode, verificationResult]);

  const handleOpenScanner = (order = null) => {
    setSelectedOrder(order);
    setScanError('');
    setVerificationResult(null);
    setManualToken('');
    setScanMode('camera');
    setScannerOpen(true);
  };

  const handleCloseScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setScannerOpen(false);
    setVerificationResult(null);
    setScanError('');
    setSelectedOrder(null);
  };

  const handleVerifyToken = async (tokenString) => {
    const token = (tokenString || manualToken || '').trim();
    if (!token) {
      setScanError('Please scan a QR code or enter a pickup verification token.');
      return;
    }

    try {
      setVerifying(true);
      setScanError('');
      const res = await orderService.verifyPickupQr(token);
      const verifiedData = res?.data || res;
      setVerificationResult(verifiedData);
      fetchOrders();
    } catch (err) {
      setScanError(err.message || 'QR Verification failed. Please check token or order conditions.');
    } finally {
      setVerifying(false);
    }
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, { status: nextStatus });
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterType === 'ALL') return true;
    return o.fulfillmentType === filterType;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Store Order Management</h1>
          <p className="text-xs text-gray-500">
            Fulfill customer pickup reservations and advance order state machine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenScanner()}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-sm transition transform active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            Scan Pickup QR
          </button>
          <button
            onClick={fetchOrders}
            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl transition"
            title="Refresh orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 text-xs font-bold">
        {[
          { key: 'ALL', label: 'All Orders' },
          { key: 'PICKUP', label: 'Self Pickup' },
          { key: 'LOCAL_DELIVERY', label: 'Local Delivery' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              filterType === tab.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner text="Retrieving store orders..." />
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const nextStatus = NEXT_STATUS_MAP[ord.status];
            const isPickup = ord.fulfillmentType === 'PICKUP';
            const isDelivered = ord.status === 'DELIVERED';

            return (
              <div key={ord._id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <span className="font-mono font-bold text-sm text-gray-900">{ord.orderNumber}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(ord.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-brand-100 text-brand-800">
                      {ord.status}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        isPickup ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ord.fulfillmentType}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        ord.paymentStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {ord.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Items & Allocations */}
                <div className="space-y-2 text-xs">
                  {ord.items?.map((it) => (
                    <div key={it._id} className="flex justify-between items-center text-gray-700">
                      <span>{it.productName} × {it.requestedQuantity}</span>
                      <span className="font-bold">₹{Number(it.lineDiscountedAmount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Actions Row */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="font-black text-sm text-gray-900">
                    Total: ₹{Number(ord.pricingSummary?.finalTotal || 0).toFixed(2)}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* QR Action Button for Self-Pickup */}
                    {isPickup && !isDelivered && (
                      <button
                        onClick={() => handleOpenScanner(ord)}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-black text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Scan Pickup QR
                      </button>
                    )}

                    {/* View Billing Receipt for Delivered Orders */}
                    {isDelivered && (
                      <button
                        onClick={() => handleOpenReceipt(ord._id)}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Billing Receipt
                      </button>
                    )}

                    {nextStatus && (
                      <button
                        onClick={() => updateOrderStatus(ord._id, nextStatus)}
                        className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                      >
                        Advance to {nextStatus.replace(/_/g, ' ')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No orders found matching this filter.
        </div>
      )}

      {/* QR Scanner & Verification Modal */}
      <Modal
        isOpen={scannerOpen}
        onClose={handleCloseScanner}
        title={verificationResult ? 'Pickup Verification Successful' : 'Scan Customer Pickup QR'}
        maxWidth="max-w-md"
      >
        {verificationResult ? (
          /* SUCCESS VIEW as requested by the user */
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="text-emerald-900 font-black text-lg">✓ Pickup Verified</div>
              <p className="text-xs text-emerald-700">Order handover confirmed atomically in MongoDB.</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                <span className="font-bold text-gray-600">Customer:</span>
                <span className="font-black text-gray-900 text-sm">
                  {verificationResult.order?.customer?.name || 'Customer'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                <span className="font-bold text-gray-600">Order:</span>
                <span className="font-mono font-bold text-gray-900">
                  #{verificationResult.order?.orderNumber}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                <span className="font-bold text-gray-600">Store:</span>
                <span className="font-semibold text-gray-900">
                  {verificationResult.order?.store?.storeName || 'Store'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                <span className="font-bold text-gray-600">Items:</span>
                <span className="font-bold text-gray-900">
                  {verificationResult.order?.itemsCount || verificationResult.order?.items?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                <span className="font-bold text-gray-600">Status:</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase text-[11px]">
                  {verificationResult.order?.status || 'Completed'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold text-gray-600">Verified at:</span>
                <span className="text-gray-900 font-mono text-[11px]">
                  {new Date(verificationResult.order?.verifiedAt || Date.now()).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (verificationResult?.order?._id) {
                    handleOpenReceipt(verificationResult.order._id);
                  }
                }}
                className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Receipt className="w-4 h-4 text-emerald-600" />
                View & Print Bill Receipt
              </button>

              <button
                type="button"
                onClick={handleCloseScanner}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow transition"
              >
                Done & Return to Orders
              </button>
            </div>
          </div>
        ) : (
          /* SCANNER / INPUT VIEW */
          <div className="space-y-4">
            {selectedOrder && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex justify-between items-center">
                <span className="font-medium">Verifying Order:</span>
                <span className="font-mono font-bold">{selectedOrder.orderNumber}</span>
              </div>
            )}

            {/* Mode Toggle: Camera vs Manual Paste */}
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setScanMode('camera')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  scanMode === 'camera' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Camera Scanner
              </button>
              <button
                type="button"
                onClick={() => setScanMode('manual')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  scanMode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                Manual Token Paste
              </button>
            </div>

            {scanError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}

            {verifying && (
              <div className="py-4">
                <LoadingSpinner text="Verifying pickup token with MongoDB source of truth..." />
              </div>
            )}

            {scanMode === 'camera' && !verifying && (
              <div className="space-y-2 text-center">
                <div
                  id="pickup-qr-reader"
                  className="overflow-hidden rounded-2xl border border-gray-200 mx-auto max-w-[320px]"
                />
                <p className="text-[11px] text-gray-500">
                  Point device camera at customer's Pickup QR screen
                </p>
              </div>
            )}

            {scanMode === 'manual' && !verifying && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Paste Customer Verification Token
                  </label>
                  <textarea
                    rows={4}
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste secure pickup token from QR..."
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleVerifyToken(manualToken)}
                  disabled={!manualToken.trim()}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-gray-950 font-black rounded-xl text-xs shadow transition"
                >
                  Verify Token
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Itemized Bill Receipt Modal */}
      <BillReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={selectedReceipt}
      />
    </div>
  );
};

