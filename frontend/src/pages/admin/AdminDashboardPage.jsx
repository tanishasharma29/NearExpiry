import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Store,
  Package,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Leaf,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import api from '../../api/client';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard');
      setDashboard(res.data?.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const triggerSweep = async () => {
    try {
      setSweeping(true);
      const res = await api.post('/admin/pricing-rules/trigger-sweep');
      alert(`Manual sweep triggered! Scanned: ${res.data?.data?.batchesScanned || 0} batches.`);
      fetchDashboard();
    } catch (err) {
      alert(err.message || 'Failed to trigger sweep');
    } finally {
      setSweeping(false);
    }
  };

  if (loading) return <LoadingSpinner text="Aggregating platform command metrics..." />;

  const m = dashboard?.metrics || {};

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-gray-950 text-white p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
            System Overseer Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">NearExpiry Platform Operations</h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time multi-store telemetry, catalog moderation & dynamic rule enforcement
          </p>
        </div>

        <button
          onClick={triggerSweep}
          disabled={sweeping}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${sweeping ? 'animate-spin' : ''}`} />
          {sweeping ? 'Running Sweep...' : 'Trigger Pricing & Expiry Sweep'}
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Merchandise Value</span>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">₹{Number(m.revenue || 0).toFixed(2)}</div>
          <div className="text-[11px] text-gray-500 mt-1">{m.orders || 0} completed orders</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Rescued Inventory</span>
            <Leaf className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{m.inventoryRescued || 0} units</div>
          <div className="text-[11px] text-gray-500 mt-1">{m.wastePrevented?.estimatedKgSaved || 0} kg saved</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Stores</span>
            <Store className="w-5 h-5 text-brand-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{m.activeStores || 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">{m.totalSellers || 0} registered sellers</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Shopper Accounts</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{m.totalCustomers || 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">{m.products || 0} catalog products</div>
        </div>
      </div>

      {/* Inventory & Expiry Health Radar */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900">Platform Expiry Radar Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs font-bold text-amber-800 uppercase">Near-Expiry Stock</div>
            <div className="text-xl font-black text-amber-900 mt-1">{m.nearExpiryInventory || 0} units</div>
            <div className="text-[11px] text-amber-700 mt-0.5">8 - 30 days remaining</div>
          </div>

          <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
            <div className="text-xs font-bold text-red-800 uppercase">Critical Lots</div>
            <div className="text-xl font-black text-red-900 mt-1">{m.criticalInventory || 0} units</div>
            <div className="text-[11px] text-red-700 mt-0.5">≤ 7 days (40-75% discount)</div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-100 border border-gray-200">
            <div className="text-xs font-bold text-gray-700 uppercase">Expired / Written Off</div>
            <div className="text-xl font-black text-gray-800 mt-1">{m.expiredInventory || 0} units</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Permanently locked from sale</div>
          </div>
        </div>
      </div>
    </div>
  );
};
