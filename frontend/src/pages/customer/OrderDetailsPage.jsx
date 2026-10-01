import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, Package, Store, MapPin, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const STATUS_STEPS = ['PLACED', 'CONFIRMED', 'PACKED', 'READY_FOR_PICKUP', 'DELIVERED'];

export const OrderDetailsPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data.data);
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-600">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Order Details</div>
          <h1 className="text-2xl font-black text-gray-900 font-mono">{order.orderNumber}</h1>
          <p className="text-xs text-gray-500 mt-1">Placed on {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="px-3 py-1.5 rounded-full font-bold text-sm bg-brand-100 text-brand-800">
          Status: {order.status}
        </div>
      </div>

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
    </div>
  );
};
