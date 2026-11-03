import React, { useState } from 'react';
import { ShieldCheck, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { sellerService } from '../../services/sellerService';

export const SellerDocumentsModal = ({ isOpen, onClose, initialData = {}, onSuccess }) => {
  const [panNumber, setPanNumber] = useState(initialData.panNumber || '');
  const [gstNumber, setGstNumber] = useState(initialData.gstNumber || '');
  const [fssaiLicenseNumber, setFssaiLicenseNumber] = useState(initialData.fssaiLicenseNumber || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPan = panNumber.trim().toUpperCase();
    const cleanGst = gstNumber.trim().toUpperCase();
    const cleanFssai = fssaiLicenseNumber.trim();

    if (!cleanPan && !cleanGst && !cleanFssai) {
      setError('Please provide at least one credential (PAN, GSTIN, or FSSAI license) to submit.');
      return;
    }

    try {
      setLoading(true);
      await sellerService.updateProfile({
        panNumber: cleanPan || undefined,
        gstNumber: cleanGst || undefined,
        fssaiLicenseNumber: cleanFssai || undefined,
      });

      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to submit documents:', err);
      setError(err.response?.data?.message || err.message || 'Failed to submit legal credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit Business & Tax Credentials" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-950 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-purple-700 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            NearExpiry stores can operate in demo mode without documents. Submitting your official tax and food credentials notifies platform governance to verify your store.
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Credentials submitted! Admin has been notified for review.</span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
            PAN Number <span className="text-gray-400 font-normal">(Permanent Account Number)</span>
          </label>
          <input
            type="text"
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            placeholder="e.g. ABCDE1234F"
            maxLength={10}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 focus:border-purple-600 rounded-xl outline-none font-mono text-xs uppercase"
          />
        </div>

        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
            GSTIN Registration <span className="text-gray-400 font-normal">(15-digit GST)</span>
          </label>
          <input
            type="text"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
            placeholder="e.g. 29ABCDE1234F1Z5"
            maxLength={15}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 focus:border-purple-600 rounded-xl outline-none font-mono text-xs uppercase"
          />
        </div>

        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-700 mb-1">
            FSSAI Food License <span className="text-gray-400 font-normal">(14-digit License)</span>
          </label>
          <input
            type="text"
            value={fssaiLicenseNumber}
            onChange={(e) => setFssaiLicenseNumber(e.target.value)}
            placeholder="e.g. 10012011000123"
            maxLength={14}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 focus:border-purple-600 rounded-xl outline-none font-mono text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || success}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{loading ? 'Submitting...' : 'Submit Credentials'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SellerDocumentsModal;
