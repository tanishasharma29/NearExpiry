import React, { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Package,
  Store,
  MapPin,
  AlertCircle,
  QrCode,
  ShieldCheck,
  Phone,
  Copy,
  Check,
  Maximize2,
  Receipt,
  FileText,
} from 'lucide-react';
import { orderService } from '../../services/orderService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';

const STATUS_STEPS = ['PLACED', 'CONFIRMED', 'PACKED', 'READY_FOR_PICKUP', 'DELIVERED'];

export const OrderDetailsPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNewOrder = searchParams.get('new') === 'true';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrError, setQrError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await orderService.getOrderById(id);
        const orderDoc = data?.order || data;
        setOrder(orderDoc);

        // Auto-fetch pickup QR immediately if it is an active self-pickup order
        if (orderDoc?.fulfillmentType === 'PICKUP' && orderDoc?.status !== 'DELIVERED') {
          setQrLoading(true);
          try {
            const qrRes = await orderService.getPickupQr(orderDoc._id);
            setQrData(qrRes?.data || qrRes);
          } catch (qrErr) {
            console.warn('Auto QR fetch error:', qrErr);
          } finally {
            setQrLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleOpenPickupQr = async () => {
    try {
      setQrError('');
      setQrModalOpen(true);
      if (!qrData) {
        setQrLoading(true);
        const res = await orderService.getPickupQr(order._id);
        setQrData(res?.data || res);
      }
    } catch (err) {
      setQrError(err.message || 'Failed to retrieve pickup QR token');
    } finally {
      setQrLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading order and timeline tracking..." />;
  if (!order) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900">Order not found</h2>
        <Link to="/orders" className="text-brand-600 font-semibold mt-4 inline-block">
          Return to Orders
        </Link>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(order.status);
  const isPickup = order.fulfillmentType === 'PICKUP';
  const isDelivered = order.status === 'DELIVERED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-600">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* New Order Celebratory Alert */}
      {isNewOrder && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 shadow-sm animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs font-semibold">
            <span className="font-bold">Order Placed Successfully!</span> Your self-pickup verification pass is active below.
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Order Details</div>
          <h1 className="text-2xl font-black text-gray-900 font-mono">{order.orderNumber}</h1>
          <p className="text-xs text-gray-500 mt-1">Placed on {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full font-bold text-sm bg-brand-100 text-brand-800">
            {order.status}
          </span>
          <span className="px-3 py-1.5 rounded-full font-bold text-sm bg-gray-100 text-gray-800">
            {order.fulfillmentType}
          </span>
        </div>
      </div>

      {/* Self Pickup Verification Card */}
      {isPickup && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-gray-950 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">Self-Pickup Counter Order</h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Pick up at {order.storeId?.storeName || 'Neighborhood Store'}
                </p>
                {order.storeId?.address && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {typeof order.storeId.address === 'object'
                        ? `${order.storeId.address.street || ''}, ${order.storeId.address.city || ''}`
                        : order.storeId.address}
                    </span>
                  </div>
                )}
                {order.storeId?.contactPhone && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{order.storeId.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {isDelivered ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-100 text-emerald-800 rounded-2xl font-bold text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Pickup Verified & Completed</span>
                </div>
                <Link
                  to={`/orders/${order._id}/invoice`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md transition transform active:scale-95"
                >
                  <Receipt className="w-4 h-4" />
                  Download / View Bill Receipt
                </Link>
              </div>
            ) : (
              <button
                onClick={handleOpenPickupQr}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-gray-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition transform active:scale-95"
              >
                <Maximize2 className="w-4 h-4" />
                Enlarge QR Pass
              </button>
            )}
          </div>

          {/* Embedded Live QR Pass */}
          {!isDelivered && (
            <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-sm flex flex-col md:flex-row items-center gap-6">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className="p-3 bg-amber-50/50 rounded-2xl border-2 border-dashed border-amber-300 relative group cursor-pointer"
                  onClick={() => setQrModalOpen(true)}
                  title="Click to enlarge QR pass"
                >
                  {qrLoading ? (
                    <div className="w-44 h-44 flex items-center justify-center">
                      <LoadingSpinner text="Loading QR..." />
                    </div>
                  ) : qrData?.qrCodeDataUrl || qrData?.qrDataUrl ? (
                    <>
                      <img
                        src={qrData.qrCodeDataUrl || qrData.qrDataUrl}
                        alt="Customer Pickup QR"
                        className="w-44 h-44 object-contain rounded-xl transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gray-950/40 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5">
                        <Maximize2 className="w-4 h-4" /> Enlarge
                      </div>
                    </>
                  ) : (
                    <div className="w-44 h-44 flex flex-col items-center justify-center text-center p-3 space-y-2">
                      <QrCode className="w-10 h-10 text-amber-500" />
                      <button
                        onClick={handleOpenPickupQr}
                        className="text-xs bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold px-3 py-1.5 rounded-xl shadow-sm transition"
                      >
                        Generate QR
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 font-medium">Click image to enlarge</span>
              </div>

              <div className="flex-1 space-y-3 text-left w-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Digital Pickup Token
                  </span>
                  {qrData?.expiresAt && (
                    <span className="text-[11px] text-gray-500">
                      Valid until: <strong className="text-gray-800">{new Date(qrData.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-gray-900 text-sm">
                  Show this QR at {order.storeId?.storeName || 'the store'} counter
                </h3>

                <p className="text-xs text-gray-600 leading-relaxed">
                  The merchant will scan this QR from their Store Orders dashboard to verify and release your order atomically.
                </p>

                {qrData?.token && (
                  <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="text-gray-500 truncate max-w-[240px]">
                      Token: <span className="font-mono font-bold text-gray-800">{qrData.token.substring(0, 16)}...</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(qrData.token);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition self-start sm:self-auto"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy Token'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isDelivered && (
            <div className="bg-white/80 backdrop-blur-sm p-3.5 rounded-2xl border border-amber-200/60 text-xs text-amber-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Cryptographic Protection:</strong> No personal emails, passwords, or card credentials are contained in this token. Verification is executed securely by NearExpiry.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900">Live Status Tracker</h2>
        <div className="flex items-center justify-between overflow-x-auto py-2">
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = currentIdx >= idx;
            const isCurrent = currentIdx === idx;
            return (
              <div key={step} className="flex-1 text-center min-w-[100px] relative">
                <div
                  className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center font-bold text-xs mb-2 transition ${
                    isCompleted
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  } ${isCurrent ? 'ring-4 ring-brand-100' : ''}`}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <div className={`text-[11px] font-semibold ${isCurrent ? 'text-brand-700 font-bold' : 'text-gray-500'}`}>
                  {step.replace(/_/g, ' ')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Allocated FEFO Items */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900">Purchased Items & Batch Allocations</h2>
        <div className="divide-y divide-gray-100">
          {order.items?.map((item) => (
            <div key={item._id} className="py-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{item.productName}</h3>
                  <div className="text-xs text-gray-500">{item.brand} • {item.requestedQuantity} unit(s)</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-gray-900 text-sm">
                    ₹{Number(item.lineDiscountedAmount).toFixed(2)}
                  </div>
                  <div className="text-xs text-green-700 font-semibold">
                    Saved ₹{Number(item.lineSavingsAmount).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Batch allocations list */}
              {item.batchAllocations?.length > 0 && (
                <div className="bg-gray-50 p-2.5 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-gray-700 uppercase">FEFO Allocations:</div>
                  {item.batchAllocations.map((alloc, aidx) => (
                    <div key={aidx} className="flex justify-between text-xs text-gray-600">
                      <span className="font-mono">Lot {alloc.batchNumber} (Expires: {new Date(alloc.expiryDate).toLocaleDateString()})</span>
                      <span className="font-semibold">{alloc.allocatedQuantity} units @ ₹{alloc.discountedUnitPrice}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
          <span className="font-semibold text-gray-700">Total Charged</span>
          <span className="text-xl font-black text-brand-700">
            ₹{Number(order.pricingSummary?.finalTotal || 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Customer Pickup QR Modal */}
      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title="Self-Pickup Verification QR">
        {qrLoading ? (
          <div className="py-8">
            <LoadingSpinner text="Generating secure cryptographic pickup token..." />
          </div>
        ) : qrError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 text-center space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
            <p className="font-bold">{qrError}</p>
          </div>
        ) : qrData ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-white border-2 border-dashed border-amber-300 rounded-3xl inline-block shadow-inner">
              <img
                src={qrData.qrCodeDataUrl || qrData.qrDataUrl}
                alt="Pickup Verification QR"
                className="w-60 h-60 mx-auto"
              />
            </div>

            <div className="text-left text-xs bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="font-bold text-gray-700">Order Number:</span>
                <span className="font-mono font-bold text-gray-900">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-gray-700">Store:</span>
                <span className="text-gray-900">{order.storeId?.storeName || 'NearExpiry Store'}</span>
              </div>
              {qrData.expiresAt && (
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">Valid Until:</span>
                  <span className="text-amber-800 font-semibold">{new Date(qrData.expiresAt).toLocaleString()}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-200 flex items-start gap-1.5 text-[11px] text-gray-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Secure QR Token:</strong> No personal details, email, or payment credentials are in this QR. The merchant scans it to verify handover atomically.
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
