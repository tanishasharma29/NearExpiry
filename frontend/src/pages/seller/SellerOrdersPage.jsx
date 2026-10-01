import React, { useEffect, useState } from 'react';
import { ShoppingBag, CheckCircle, Package, Truck, Store, IndianRupee } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const NEXT_STATUS_MAP = {
  CONFIRMED: 'PACKED',
  PACKED: 'READY_FOR_PICKUP',
  READY_FOR_PICKUP: 'DELIVERED',
};

export const SellerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const updateOrderStatus = async (orderId, nextStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, { status: nextStatus });
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const confirmCod = async (paymentId) => {
    try {
      await paymentService.confirmCodPayment(paymentId);
      alert('Cash payment confirmed successfully!');
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to confirm COD');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Store Order Management</h1>
        <p className="text-xs text-gray-500">Fulfill customer reservations and advance order state machine</p>
      </div>

      {loading ? (
        <LoadingSpinner text="Retrieving store orders..." />
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((ord) => {
            const nextStatus = NEXT_STATUS_MAP[ord.status];
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
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                      {ord.fulfillmentType}
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
          No orders received yet.
        </div>
      )}
    </div>
  );
};
