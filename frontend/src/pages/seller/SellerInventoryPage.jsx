import React, { useEffect, useState } from 'react';
import { batchService } from '../../services/batchService';
import { Boxes, PackageCheck, AlertCircle, Clock } from 'lucide-react';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const SellerInventoryPage = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    batchService.getBatches()
      .then((data) => setBatches(data?.batches || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Querying live store inventory..." />;

  const totalUnits = batches.reduce((acc, b) => acc + (b.quantity || 0), 0);
  const totalValuation = batches.reduce((acc, b) => acc + (b.quantity || 0) * (b.currentPrice || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Inventory Monitoring & Stock Valuations</h1>
        <p className="text-xs text-gray-500">Track reserve states, quantities, and real-time inventory valuations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-bold text-gray-400 uppercase">Total Inventory Units</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{totalUnits}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-bold text-gray-400 uppercase">Live Inventory Valuation</div>
          <div className="text-2xl font-black text-brand-600 mt-1">₹{totalValuation.toFixed(2)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-bold text-gray-400 uppercase">Active Lots</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{batches.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold uppercase">
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Batch Number</th>
              <th className="py-3 px-4">Available Qty</th>
              <th className="py-3 px-4">Current Price</th>
              <th className="py-3 px-4">Lot Valuation</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium">
            {batches.map((b) => (
              <tr key={b._id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-bold text-gray-900">{b.productId?.name || 'Catalog Item'}</td>
                <td className="py-3 px-4 font-mono text-gray-700">{b.batchNumber}</td>
                <td className="py-3 px-4 font-bold text-gray-900">{b.quantity}</td>
                <td className="py-3 px-4 text-gray-800">₹{Number(b.currentPrice).toFixed(2)}</td>
                <td className="py-3 px-4 font-black text-brand-700">
                  ₹{(Number(b.quantity) * Number(b.currentPrice)).toFixed(2)}
                </td>
                <td className="py-3 px-4">
                  <ExpiryBadge remainingDays={b.remainingDays} status={b.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
