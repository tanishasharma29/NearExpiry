import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Layers, AlertTriangle, Clock, TrendingUp, IndianRupee, ArrowRight, PlusCircle, BellRing } from 'lucide-react';
import api from '../../api/client';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const SellerDashboardPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [anRes, ordRes] = await Promise.all([
          api.get('/analytics/seller?period=30d'),
          api.get('/orders/seller?limit=5'),
        ]);
        setAnalytics(anRes.data?.data);
        setRecentOrders(ordRes.data?.data?.orders || []);
      } catch (err) {
        console.error('Failed to load seller dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <LoadingSpinner text="Compiling store dashboard..." />;

  const kpis = analytics?.kpis || {};

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
            Store Command Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            {analytics?.store?.storeName || 'Merchant Supermarket'}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            NearExpiry dynamic pricing automatically optimizes your stock to minimize food write-offs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/seller/products"
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow"
          >
            <PlusCircle className="w-4 h-4" /> Add Product
          </Link>
          <Link
            to="/seller/batches"
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow"
          >
            <Layers className="w-4 h-4" /> Register Batch
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Stock</span>
            <Package className="w-5 h-5 text-brand-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{kpis.totalInventory || 0} units</div>
          <div className="text-[11px] text-gray-500 mt-1">Across all registered lots</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-red-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Critical Stock (≤2d)</span>
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-red-600">{kpis.criticalInventory || 0} units</div>
          <div className="text-[11px] text-red-500 font-medium mt-1">75% discount active</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Approaching (8-15d)</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{kpis.expiringInventory || 0} units</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">25-40% discount active</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Store Revenue</span>
            <IndianRupee className="w-5 h-5 text-brand-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">₹{Number(kpis.revenue || 0).toFixed(2)}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {kpis.unitsSold || 0} units rescued
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Recent Customer Orders</h2>
          <Link to="/seller/orders" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View All Orders <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {recentOrders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900">{ord.orderNumber}</td>
                    <td className="py-3 px-4 text-gray-600">{ord.items?.length || 0} items</td>
                    <td className="py-3 px-4 font-bold text-gray-900">₹{Number(ord.pricingSummary?.finalTotal || 0).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{ord.fulfillmentType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-500">No customer orders placed yet.</p>
        )}
      </div>
    </div>
  );
};
