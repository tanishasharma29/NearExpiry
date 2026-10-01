import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import api from '../../api/client';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const SellerExpiryAlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/expiry/alerts');
      setAlerts(res.data?.data?.alerts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const acknowledgeAlert = async (id) => {
    try {
      await api.patch(`/expiry/alerts/${id}/acknowledge`);
      fetchAlerts();
    } catch (err) {
      alert(err.message || 'Failed to acknowledge alert');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Expiry Alerts Radar</h1>
        <p className="text-xs text-gray-500">
          Automated node-cron alerts for approaching, critical, and expired lots
        </p>
      </div>

      {loading ? (
        <LoadingSpinner text="Scanning alert radar..." />
      ) : alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((al) => (
            <div
              key={al._id}
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                al.severity === 'CRITICAL'
                  ? 'bg-red-50/70 border-red-200'
                  : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                  al.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'
                }`} />
                <div>
                  <div className="text-xs font-bold text-gray-900">{al.title}</div>
                  <div className="text-xs text-gray-600">{al.message}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(al.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {!al.isAcknowledged ? (
                <button
                  onClick={() => acknowledgeAlert(al._id)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 font-bold text-xs text-gray-700 hover:bg-gray-100 transition flex-shrink-0 shadow-sm"
                >
                  Acknowledge
                </button>
              ) : (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Acknowledged
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No unacknowledged alerts on your radar. All batches are within safe shelf life.
        </div>
      )}
    </div>
  );
};
