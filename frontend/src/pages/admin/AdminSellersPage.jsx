import React, { useEffect, useState } from 'react';
import { Store, Check, X, ShieldAlert, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminSellersPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [reason, setReason] = useState('');

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/sellers');
      setSellers(res.data?.data?.sellers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleApprove = async (sellerId) => {
    try {
      await api.patch(`/admin/sellers/${sellerId}/approval`, { status: 'APPROVED' });
      alert('Seller approved and store activated successfully!');
      fetchSellers();
    } catch (err) {
      alert(err.message || 'Failed to approve seller');
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return alert('Please enter a rejection reason');
    try {
      await api.patch(`/admin/sellers/${selectedSeller._id}/approval`, {
        status: 'REJECTED',
        rejectionReason: reason,
      });
      setRejectModalOpen(false);
      setReason('');
      setSelectedSeller(null);
      fetchSellers();
    } catch (err) {
      alert(err.message || 'Failed to reject seller');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Seller Verification & Onboarding</h1>
        <p className="text-xs text-gray-500">Review retailer KYC, approve store permits, or reject applicants</p>
      </div>

      {loading ? (
        <LoadingSpinner text="Retrieving seller directory..." />
      ) : sellers.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold uppercase">
                <th className="py-3 px-4">Owner Name</th>
                <th className="py-3 px-4">Store Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {sellers.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold text-gray-900">{s.name}</td>
                  <td className="py-3 px-4 text-gray-700">{s.storeName || 'Store'}</td>
                  <td className="py-3 px-4 text-gray-500">{s.email}</td>
                  <td className="py-3 px-4 text-gray-500">{s.phone}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      s.verificationStatus === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : s.verificationStatus === 'REJECTED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {s.verificationStatus || 'PENDING'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {s.verificationStatus === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(s._id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSeller(s);
                            setRejectModalOpen(true);
                          }}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No sellers registered.
        </div>
      )}

      {/* Reject Modal */}
      <Modal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Reject Seller Application">
        <div className="space-y-4 text-xs">
          <p className="text-gray-600">
            Specify the formal reason for rejecting <span className="font-bold text-gray-900">{selectedSeller?.storeName}</span>:
          </p>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Incomplete business address or invalid food license"
            className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
          />
          <button
            onClick={handleReject}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition"
          >
            Confirm Rejection
          </button>
        </div>
      </Modal>
    </div>
  );
};
