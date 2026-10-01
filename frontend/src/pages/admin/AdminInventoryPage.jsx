import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Boxes } from 'lucide-react';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminInventoryPage = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/inventory')
      .then((res) => setBatches(res.data?.data?.inventory || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Scanning cross-store inventory..." />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Global Inventory Radar</h1>
        <p className="text-xs text-gray-500">Cross-store real-time inventory monitoring and valuations</p>
      </div>

      {batches.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold uppercase">
                <th className="py-3 px-4">Store</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Remaining Days</th>
                <th className="py-3 px-4">Dynamic Price</th>
                <th className="py-3 px-4">Available Units</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {batches.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold text-gray-900">{b.storeId?.storeName || 'Store'}</td>
                  <td className="py-3 px-4 text-gray-800">{b.productId?.name || 'Product'}</td>
                  <td className="py-3 px-4 font-mono text-gray-700">{b.batchNumber}</td>
                  <td className="py-3 px-4">
                    <ExpiryBadge remainingDays={b.remainingDays} status={b.status} />
                  </td>
                  <td className="py-3 px-4 font-black text-gray-900">₹{Number(b.currentPrice).toFixed(2)}</td>
                  <td className="py-3 px-4 font-bold text-gray-800">{b.quantity}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-[11px] text-gray-700">{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No inventory batches active.
        </div>
      )}
    </div>
  );
};
