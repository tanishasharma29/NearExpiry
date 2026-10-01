import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, QrCode, Layers, AlertCircle, ShieldCheck } from 'lucide-react';
import { batchService } from '../../services/batchService';
import { productService } from '../../services/productService';
import { Modal } from '../../components/common/Modal';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const batchSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  manufacturingDate: z.string().min(1, 'Manufacturing date required'),
  expiryDate: z.string().min(1, 'Expiry date required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  originalPrice: z.coerce.number().min(1, 'Original price must be > 0'),
});

export const SellerBatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(batchSchema),
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [bData, pData] = await Promise.all([
        batchService.getBatches(),
        productService.getProducts(),
      ]);
      setBatches(bData?.batches || []);
      setProducts(pData?.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSubmit = async (data) => {
    try {
      setServerError('');
      await batchService.createBatch(data);
      setModalOpen(false);
      reset();
      loadData();
    } catch (err) {
      setServerError(err.message || 'Failed to register batch');
    }
  };

  const handleShowQr = async (batchId) => {
    try {
      const qrData = await batchService.getBatchQrCode(batchId);
      setQrData(qrData);
      setQrModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to generate QR code');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">FEFO Expiry Batches</h1>
          <p className="text-xs text-gray-500">
            Register individual shelf-life lots with automated dynamic pricing algorithms
          </p>
        </div>
        <button
          onClick={() => {
            setServerError('');
            setModalOpen(true);
          }}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
        >
          <Plus className="w-4 h-4" /> Register New Batch
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Retrieving registered batches..." />
      ) : batches.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold uppercase">
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Shelf Life</th>
                <th className="py-3 px-4">Original</th>
                <th className="py-3 px-4">Dynamic Price</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">QR Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {batches.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono font-bold text-gray-900">{b.batchNumber}</td>
                  <td className="py-3 px-4 text-gray-800">{b.productId?.name || 'Product'}</td>
                  <td className="py-3 px-4 text-gray-600">{new Date(b.expiryDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <ExpiryBadge remainingDays={b.remainingDays} status={b.status} />
                  </td>
                  <td className="py-3 px-4 text-gray-400 line-through">₹{Number(b.originalPrice).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className="font-black text-gray-900">₹{Number(b.currentPrice).toFixed(2)}</span>
                    <span className="text-[10px] text-green-700 ml-1 font-bold">({b.discountPercentage}% off)</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-900">{b.quantity}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleShowQr(b._id)}
                      className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                      title="Generate Cryptographic QR"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center text-gray-500">
          No batches registered yet. Click "Register New Batch" to add lot inventory.
        </div>
      )}

      {/* Add Batch Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Register New FEFO Batch">
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 uppercase mb-1">Catalog Product</label>
            <select
              {...register('productId')}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
            >
              <option value="">Select Catalog Item</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.brand})
                </option>
              ))}
            </select>
            {errors.productId && <p className="text-red-600 mt-1">{errors.productId.message}</p>}
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase mb-1">Lot / Batch Number</label>
            <input
              type="text"
              {...register('batchNumber')}
              placeholder="e.g. LOT-2026-OCT-01"
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none uppercase font-mono"
            />
            {errors.batchNumber && <p className="text-red-600 mt-1">{errors.batchNumber.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Manufacturing Date</label>
              <input
                type="date"
                {...register('manufacturingDate')}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
              />
              {errors.manufacturingDate && <p className="text-red-600 mt-1">{errors.manufacturingDate.message}</p>}
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Expiry / Best Before</label>
              <input
                type="date"
                {...register('expiryDate')}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
              />
              {errors.expiryDate && <p className="text-red-600 mt-1">{errors.expiryDate.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Quantity (Units)</label>
              <input
                type="number"
                {...register('quantity')}
                placeholder="20"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
              />
              {errors.quantity && <p className="text-red-600 mt-1">{errors.quantity.message}</p>}
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1">Original Retail Price (₹)</label>
              <input
                type="number"
                step="0.01"
                {...register('originalPrice')}
                placeholder="100.00"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl outline-none"
              />
              {errors.originalPrice && <p className="text-red-600 mt-1">{errors.originalPrice.message}</p>}
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-[11px]">
            ℹ️ Dynamic discount percentage will be automatically applied by the server engine based on remaining calendar days.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-xl shadow transition"
          >
            {isSubmitting ? 'Registering...' : 'Register Batch in MongoDB'}
          </button>
        </form>
      </Modal>

      {/* QR Code Modal */}
      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title="Cryptographic Batch QR Code">
        {qrData && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-white border border-gray-200 rounded-2xl inline-block shadow-inner">
              <img src={qrData.qrCodeDataUrl} alt="Batch QR Code" className="w-56 h-56 mx-auto" />
            </div>

            <div className="text-left text-xs bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
              <div><span className="font-bold text-gray-700">Batch Number:</span> {qrData.batchNumber}</div>
              <div><span className="font-bold text-gray-700">Expiry Date:</span> {new Date(qrData.expiryDate).toLocaleDateString()}</div>
              <div><span className="font-bold text-gray-700">Verification Nonce:</span> <code className="text-gray-600 font-mono text-[10px] break-all">{qrData.nonce}</code></div>
              <div className="text-[11px] text-emerald-700 font-semibold pt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live server verification required upon customer scanning.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
