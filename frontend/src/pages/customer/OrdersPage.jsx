import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, ChevronRight, CheckCircle2, QrCode } from 'lucide-react';
import { orderService } from '../../services/orderService';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const data = await orderService.getCustomerOrders();
        setOrders(data?.orders || (Array.isArray(data) ? data : []));
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) return <LoadingSpinner text="Retrieving order history..." />;

  if (orders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          icon={Package}
          title="No orders placed yet"
          description="Your placed orders and live pickup tracking will appear here."
          actionLabel="Explore Near-Expiry Deals"
          actionLink="/marketplace"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Your Orders</h1>
        <p className="text-sm text-gray-500">Track fulfillment status and FEFO allocations</p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Link
            key={order._id}
            to={`/orders/${order._id}`}
            className="block bg-white p-5 rounded-2xl border border-gray-200 hover:border-brand-500 hover:shadow-md transition"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-gray-900">{order.orderNumber}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-brand-100 text-brand-800">
                    {order.status}
                  </span>
                  {order.fulfillmentType === 'PICKUP' && order.status !== 'DELIVERED' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shadow-xs">
                      <QrCode className="w-3 h-3 text-amber-600" /> Pickup QR Ready
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString()} at{' '}
                  {new Date(order.createdAt).toLocaleTimeString()}
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  {order.items?.length || 0} product(s) • {order.fulfillmentType}
                </div>
              </div>

              <div className="flex items-center gap-4 sm:text-right">
                <div>
                  <div className="text-xs text-gray-400">Amount Paid</div>
                  <div className="text-lg font-black text-gray-900">
                    ₹{Number(order.pricingSummary?.finalTotal || 0).toFixed(2)}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
