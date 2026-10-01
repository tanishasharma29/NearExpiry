import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Sliders, RefreshCw, RotateCcw, Plus, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminPricingPage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/pricing-rules');
      setRules(res.data?.data?.rules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all dynamic pricing rules back to standard default 6 tiers?')) return;
    try {
      await api.post('/admin/pricing-rules/reset-defaults');
      alert('Reset to defaults successfully!');
      fetchRules();
    } catch (err) {
      alert(err.message || 'Failed to reset rules');
    }
  };

  const handleTriggerSweep = async () => {
    try {
      setSweeping(true);
      const res = await api.post('/admin/pricing-rules/trigger-sweep');
      alert(`Dynamic sweep finished! Batches scanned: ${res.data?.data?.batchesScanned || 0}`);
    } catch (err) {
      alert(err.message || 'Failed to trigger sweep');
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Dynamic Pricing Engine Rules</h1>
          <p className="text-xs text-gray-500">Configurable tier rules controlling automated FEFO discounts</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
            Reset Defaults
          </button>
          <button
            onClick={handleTriggerSweep}
            disabled={sweeping}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sweeping ? 'animate-spin' : ''}`} />
            Trigger Recalculation
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Retrieving dynamic pricing rules..." />
      ) : rules.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold uppercase">
                <th className="py-3 px-4">Tier / Name</th>
                <th className="py-3 px-4">Min Days</th>
                <th className="py-3 px-4">Max Days</th>
                <th className="py-3 px-4">Discount Applied</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {rules.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold text-gray-900">{r.name}</td>
                  <td className="py-3 px-4 text-gray-700">{r.minDays}</td>
                  <td className="py-3 px-4 text-gray-700">{r.maxDays !== null ? r.maxDays : '∞'}</td>
                  <td className="py-3 px-4 font-black text-brand-700 text-sm">{r.discountPercentage}% OFF</td>
                  <td className="py-3 px-4 text-gray-500">{r.priority}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {r.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No pricing rules configured. Click "Reset Defaults" to seed standard 6 tiers.
        </div>
      )}
    </div>
  );
};
