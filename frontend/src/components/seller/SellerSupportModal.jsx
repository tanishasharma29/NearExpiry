import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Send, LifeBuoy } from 'lucide-react';
import { Modal } from '../common/Modal';
import { sellerService } from '../../services/sellerService';

export const SellerSupportModal = ({ isOpen, onClose, defaultSubject, defaultMessage }) => {
  const [subject, setSubject] = useState(
    defaultSubject || 'Store Legal Document Verification Request'
  );
  const [message, setMessage] = useState(
    defaultMessage ||
      'Hello Admin, my store is currently registered/approved for demo use. Please advise on the verification process for our PAN, GSTIN, and FSSAI credentials.'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Please provide both a subject and a message.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await sellerService.submitSupportRequest({
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccessResult(res?.data || res);
    } catch (err) {
      setError(err.message || 'Failed to submit support request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Contact Admin Support">
      {successResult ? (
        <div className="space-y-4 text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-900">Support Request Dispatched</h4>
            <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
              Your inquiry has been sent to the NearExpiry admin team.
            </p>
            {successResult.ticketId && (
              <div className="mt-3 inline-block px-3 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono font-bold text-gray-800">
                Ticket Ref: {successResult.ticketId}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-0.5">
              <LifeBuoy className="w-3.5 h-3.5 text-brand-600" />
              <span>Demo Store Document Verification</span>
            </div>
            Stores on NearExpiry can operate in demo mode without legal documents. If you have legitimate PAN, GSTIN, or FSSAI credentials ready for review, submit your details below to notify platform governance.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Subject *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Request legal document verification"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
              Message / Inquiries *
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your verification inquiry or provide references to your business credentials..."
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Sending Request...' : 'Submit to Admin'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

