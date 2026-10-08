import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Package,
  ShieldAlert,
  Store,
  X,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { complaintService } from '../../services/complaintService';

const COMPLAINT_CATEGORIES = [
  { value: 'ORDER_NOT_RECEIVED', label: 'Order Not Received / Missing Handover' },
  { value: 'WRONG_PRODUCT', label: 'Wrong Product Delivered' },
  { value: 'DAMAGED_PRODUCT', label: 'Damaged Product or Broken Seal' },
  { value: 'EXPIRED_OR_UNSAFE_PRODUCT', label: 'Expired or Unsafe Product' },
  { value: 'MISSING_ITEM', label: 'Missing Item from Order' },
  { value: 'PAYMENT_PROBLEM', label: 'Payment Issue or Double Charge' },
  { value: 'REFUND_PROBLEM', label: 'Refund Delay or Calculation Issue' },
  { value: 'PICKUP_PROBLEM', label: 'Store Pickup Problem' },
  { value: 'DELIVERY_PROBLEM', label: 'Delivery or Transit Delay' },
  { value: 'PRODUCT_QUALITY', label: 'Quality Concern or Spoiled Item' },
  { value: 'SELLER_DISPUTE', label: 'Dispute with Store Merchant' },
  { value: 'OTHER', label: 'Other Problem' },
];

export const CreateComplaintModal = ({ isOpen, onClose, order, onSuccess }) => {
  const [category, setCategory] = useState('');
  const [relatedItemId, setRelatedItemId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  if (!order) return null;

  const validateForm = () => {
    const errs = {};

    if (!category) {
      errs.category = 'Please select a complaint category.';
    }

    if (!subject.trim()) {
      errs.subject = 'Subject is required.';
    } else if (subject.trim().length < 3) {
      errs.subject = 'Subject must be at least 3 characters.';
    } else if (subject.trim().length > 200) {
      errs.subject = 'Subject cannot exceed 200 characters.';
    }

    if (!description.trim()) {
      errs.description = 'Please describe what happened.';
    } else if (description.trim().length < 10) {
      errs.description = 'Description must be at least 10 characters.';
    } else if (description.trim().length > 3000) {
      errs.description = 'Description cannot exceed 3000 characters.';
    }

    if (evidenceUrl.trim()) {
      try {
        const parsed = new URL(evidenceUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errs.evidenceUrl = 'Please enter a valid web URL starting with http:// or https://';
        }
      } catch {
        errs.evidenceUrl = 'Please enter a valid image URL.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const payload = {
        orderId: order._id,
        category,
        subject: subject.trim(),
        description: description.trim(),
        relatedItemId: relatedItemId || null,
        evidenceUrls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
      };

      const res = await complaintService.createComplaint(payload);
      const createdComplaint = res?.data || res;
      setSuccessResult(createdComplaint);

      if (typeof onSuccess === 'function') {
        onSuccess(createdComplaint);
      }
    } catch (err) {
      console.error('Complaint submission error:', err);
      setApiError(err.message || 'Failed to submit complaint. Please check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setCategory('');
    setRelatedItemId('');
    setSubject('');
    setDescription('');
    setEvidenceUrl('');
    setErrors({});
    setApiError('');
    setSuccessResult(null);
    onClose();
  };

  const isExpiredCategory = category === 'EXPIRED_OR_UNSAFE_PRODUCT';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={successResult ? 'Dispute Filed Successfully' : 'Report an Issue with Order'}
      maxWidth="max-w-2xl"
    >
      {successResult ? (
        <div className="py-6 px-2 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-gray-900">Complaint Submitted</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Your dispute for Order <strong className="font-mono text-gray-900">#{order.orderNumber}</strong> has been received and opened for investigation.
            </p>
          </div>

          {/* Dispute Reference Dossier */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-left text-xs space-y-3 max-w-md mx-auto shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px]">Complaint Ref</span>
              <span className="font-mono font-black text-sm text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                {successResult.complaintNumber}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-600">Current Status:</span>
              <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-amber-100 text-amber-800">
                {successResult.status || 'OPEN'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-600">Category:</span>
              <span className="text-gray-800 font-semibold">{successResult.category}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-600">Store:</span>
              <span className="text-gray-800 font-semibold">{order.storeId?.storeName || 'Store'}</span>
            </div>

            <div className="pt-2 border-t border-gray-200 text-[11px] text-gray-500 flex items-start gap-1.5">
              <HelpCircle className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <span>
                Our moderation team will review this case against store batch allocations and keep you updated in your notification inbox.
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition transform active:scale-95"
            >
              Done & Return to Order
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {apiError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Submission Error</p>
                <p>{apiError}</p>
              </div>
            </div>
          )}

          {/* 1. Context Snapshot Header */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Target Order</div>
              <div className="font-mono font-bold text-sm text-gray-900">#{order.orderNumber}</div>
              <div className="text-gray-500 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-gray-400" />
                <span>{order.storeId?.storeName || 'NearExpiry Store'}</span>
              </div>
            </div>
            <div className="text-left sm:text-right space-y-0.5">
              <div className="text-gray-500">Placed: {new Date(order.createdAt).toLocaleDateString()}</div>
              <div className="font-black text-gray-900">Total: ₹{Number(order.pricingSummary?.finalTotal || 0).toFixed(2)}</div>
            </div>
          </div>

          {/* 2. Affected Item Selection */}
          <div className="space-y-1.5">
            <label htmlFor="affected-item" className="block text-xs font-bold text-gray-700">
              Affected Item / Scope
            </label>
            <select
              id="affected-item"
              value={relatedItemId}
              onChange={(e) => setRelatedItemId(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-medium text-gray-800"
            >
              <option value="">Entire Order (General Issue)</option>
              {order.items?.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.productName} ({item.requestedQuantity} unit{item.requestedQuantity > 1 ? 's' : ''})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500">
              Select a specific product if the issue relates only to one item.
            </p>
          </div>

          {/* 3. Category Selection */}
          <div className="space-y-1.5">
            <label htmlFor="complaint-category" className="block text-xs font-bold text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="complaint-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
              }}
              className={`w-full text-xs px-3.5 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-gray-800 ${
                errors.category ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-brand-500'
              }`}
            >
              <option value="">-- Select issue type --</option>
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-[11px] text-red-600 font-medium">{errors.category}</p>}
          </div>

          {/* Special UX for Expired / Unsafe Product */}
          {isExpiredCategory && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 text-xs shadow-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950">Product Safety & Shelf-Life Assessment</p>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  As an expiry-rescue platform, customer safety is paramount. Please specify any batch lot numbers, packaging defects, off-odors, or dates observed. Our moderation team will inspect the seller's batch inventory logs and take appropriate corrective action.
                </p>
              </div>
            </div>
          )}

          {/* 4. Subject */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="complaint-subject" className="block text-xs font-bold text-gray-700">
                Subject <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400 font-mono">{subject.length}/200</span>
            </div>
            <input
              id="complaint-subject"
              type="text"
              maxLength={200}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (errors.subject) setErrors((prev) => ({ ...prev, subject: '' }));
              }}
              placeholder="Brief summary of the issue (e.g. Milk bottle seal damaged upon delivery)"
              className={`w-full text-xs px-3.5 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-gray-800 placeholder-gray-400 ${
                errors.subject ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-brand-500'
              }`}
            />
            {errors.subject && <p className="text-[11px] text-red-600 font-medium">{errors.subject}</p>}
          </div>

          {/* 5. Description */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="complaint-description" className="block text-xs font-bold text-gray-700">
                Detailed Description <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400 font-mono">{description.length}/3000</span>
            </div>
            <textarea
              id="complaint-description"
              rows={4}
              maxLength={3000}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="Tell us what happened with your order. Include details such as item condition, packaging, or store interaction..."
              className={`w-full text-xs px-3.5 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-gray-800 placeholder-gray-400 leading-relaxed ${
                errors.description ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-brand-500'
              }`}
            />
            {errors.description && <p className="text-[11px] text-red-600 font-medium">{errors.description}</p>}
          </div>

          {/* 6. Evidence Link */}
          <div className="space-y-1.5">
            <label htmlFor="complaint-evidence" className="block text-xs font-bold text-gray-700">
              Evidence Image URL <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <input
                id="complaint-evidence"
                type="url"
                value={evidenceUrl}
                onChange={(e) => {
                  setEvidenceUrl(e.target.value);
                  if (errors.evidenceUrl) setErrors((prev) => ({ ...prev, evidenceUrl: '' }));
                }}
                placeholder="https://example.com/photo-of-damage.jpg"
                className={`w-full text-xs pl-9 pr-3.5 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-gray-800 placeholder-gray-400 ${
                  errors.evidenceUrl ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-brand-500'
                }`}
              />
              <ImageIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            {errors.evidenceUrl && <p className="text-[11px] text-red-600 font-medium">{errors.evidenceUrl}</p>}
            <p className="text-[11px] text-gray-500">
              Provide a direct image link showing the product condition, expiry label, or receipt if available.
            </p>

            {/* Live Preview if Valid URL provided */}
            {evidenceUrl.trim() && !errors.evidenceUrl && (
              <div className="mt-2 p-2 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
                <img
                  src={evidenceUrl.trim()}
                  alt="Evidence preview"
                  onError={() => setErrors((prev) => ({ ...prev, evidenceUrl: 'Unable to load image from this URL.' }))}
                  className="w-12 h-12 object-cover rounded-lg border border-gray-200 bg-white shrink-0"
                />
                <div className="text-[11px] text-gray-600 truncate flex-1 font-mono">
                  {evidenceUrl.trim()}
                </div>
                <button
                  type="button"
                  onClick={() => setEvidenceUrl('')}
                  className="p-1 text-gray-400 hover:text-red-500 transition"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
            <button
              type="button"
              onClick={handleResetAndClose}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 rounded-xl shadow-md transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Dispute...</span>
                </>
              ) : (
                <span>Submit Complaint</span>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default CreateComplaintModal;

