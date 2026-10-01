import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { analyticsService } from '../../services/analyticsService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminAnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await analyticsService.getAdminAnalytics(period);
        setData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  if (loading) return <LoadingSpinner text="Rendering platform Recharts telemetry..." />;

  const { kpis = {}, charts = {} } = data || {};
  const { salesOverTime = [], categoryPerformance = [], expiryUrgencyDistribution = [] } = charts;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header & Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Platform Analytics (Recharts Engine)</h1>
          <p className="text-xs text-gray-500">
            Natively aggregated inside MongoDB pipelines with zero Node.js memory overhead
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-xs">
          {['7d', '30d', '90d', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg font-bold uppercase transition ${
                period === p ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200">
          <div className="text-xs text-gray-400 font-semibold uppercase">Platform GMV</div>
          <div className="text-xl font-black text-gray-900 mt-1">₹{Number(kpis.gmv || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200">
          <div className="text-xs text-gray-400 font-semibold uppercase">Customer Revenue</div>
          <div className="text-xl font-black text-purple-700 mt-1">₹{Number(kpis.revenue || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200">
          <div className="text-xs text-gray-400 font-semibold uppercase">Rescued Units</div>
          <div className="text-xl font-black text-brand-600 mt-1">{kpis.rescuedInventory || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200">
          <div className="text-xs text-gray-400 font-semibold uppercase">CO₂ Offset Equivalent</div>
          <div className="text-xl font-black text-emerald-600 mt-1">
            {kpis.wastePrevented?.carbonOffsetEquivalentKg || 0} kg
          </div>
        </div>
      </div>

      {/* Chart 1: Platform GMV and Revenue Over Time */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900">GMV & Revenue Over Time (₹)</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7e22ce" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#7e22ce" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="gmv" stroke="#7e22ce" fillOpacity={1} fill="url(#gmvGrad)" name="GMV (₹)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 2: Expiry Urgency Tier Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900">Platform Expiry Urgency Distribution</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expiryUrgencyDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="units" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Units in Shelf-Life Tier" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Category Revenue Breakdown */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900">Platform Category Performance (₹)</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#7e22ce" radius={[6, 6, 0, 0]} name="Category Revenue (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
