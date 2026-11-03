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
  Upload,
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
  const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'url'
  const [imagePreview, setImagePreview] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  if (!order) return null;

  // File selection handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setErrors((prev) => ({
        ...prev,
        evidence: 'Please select a valid image file (PNG, JPG, or WEBP).',
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        evidence: 'Evidence image file size must be less than 5MB.',
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, evidence: '' }));
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      setImagePreview(result);
      setFileBase64(result);
      setEvidenceUrl('');
    };
    reader.readAsDataURL(file);
  };

  // Direct URL change handler
  const handleUrlChange = (url) => {
    setEvidenceUrl(url);
    setImagePreview(url);
    setSelectedFile(null);
    setFileBase64(null);
    if (errors.evidence) setErrors((prev) => ({ ...prev, evidence: '' }));
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setImagePreview('');
    setSelectedFile(null);
    setFileBase64(null);
    setEvidenceUrl('');
    if (errors.evidence) setErrors((prev) => ({ ...prev, evidence: '' }));
  };

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

    if (imageInputMode === 'url' && evidenceUrl.trim()) {
      try {
        const parsed = new URL(evidenceUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errs.evidence = 'Please enter a valid web URL starting with http:// or https://';
        }
      } catch {
        errs.evidence = 'Please enter a valid image URL.';
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
      let finalEvidenceUrls = [];

      // If user uploaded a file, send to backend upload endpoint first
      if (imageInputMode === 'upload' && fileBase64) {
        setUploadingImage(true);
        try {
          const uploadRes = await complaintService.uploadEvidenceImage({
            image: fileBase64,
            filename: selectedFile?.name || 'evidence.jpg',
          });
          const uploadedUrl = uploadRes?.data?.url || uploadRes?.url;
          if (uploadedUrl) {
            finalEvidenceUrls.push(uploadedUrl);
          }
        } catch (uploadErr) {
          console.error('Evidence upload error:', uploadErr);
          setErrors((prev) => ({
            ...prev,
            evidence: uploadErr.message || 'Failed to upload evidence photo. Please check the file and try again.',
          }));
          setSubmitting(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      } else if (imageInputMode === 'url' && evidenceUrl.trim()) {
        finalEvidenceUrls.push(evidenceUrl.trim());
      }

      const payload = {
        orderId: order._id,
        category,
        subject: subject.trim(),
        description: description.trim(),
        relatedItemId: relatedItemId || null,
        evidenceUrls: finalEvidenceUrls,
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
    setImageInputMode('upload');
    setImagePreview('');
    setSelectedFile(null);
    setFileBase64(null);
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

          {/* 6. Evidence Photo / URL Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700">
                Evidence Photo <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setImageInputMode('upload');
                    if (errors.evidence) setErrors((prev) => ({ ...prev, evidence: '' }));
                  }}
                  className={`px-2.5 py-1 rounded-md transition ${
                    imageInputMode === 'upload'
                      ? 'bg-white text-brand-700 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageInputMode('url');
                    if (errors.evidence) setErrors((prev) => ({ ...prev, evidence: '' }));
                  }}
                  className={`px-2.5 py-1 rounded-md transition ${
                    imageInputMode === 'url'
                      ? 'bg-white text-brand-700 shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {imagePreview ? (
              <div className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                <img
                  src={imagePreview}
                  alt="Evidence preview"
                  className="w-14 h-14 rounded-lg object-cover border border-gray-200 bg-white flex-shrink-0"
                  onError={() => {
                    setErrors((prev) => ({
                      ...prev,
                      evidence: 'Unable to load image from the provided source. Please check the URL or select another photo.',
                    }));
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-800 truncate">
                    {selectedFile ? selectedFile.name : 'Evidence photo attached'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(0)} KB • Ready to submit`
                      : evidenceUrl || 'Direct Web Image URL'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-bold border border-rose-200 transition flex items-center gap-1 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            ) : imageInputMode === 'upload' ? (
              <label className="border-2 border-dashed border-gray-300 hover:border-brand-500 hover:bg-brand-50/20 transition rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer group bg-gray-50/50">
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-brand-600 mb-1 transition" />
                <span className="text-xs font-semibold text-gray-700 group-hover:text-brand-700 text-center">
                  Click to select evidence photo from your device
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WEBP up to 5MB</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/jpg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://example.com/photo-of-damage.jpg"
                    value={evidenceUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className={`w-full text-xs pl-9 pr-3.5 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-gray-800 placeholder-gray-400 ${
                      errors.evidence ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-brand-500'
                    }`}
                  />
                  <ImageIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Paste a direct web link to an image file</p>
              </div>
            )}

            {errors.evidence && <p className="text-[11px] text-red-600 font-medium">{errors.evidence}</p>}
            <p className="text-[11px] text-gray-500">
              Provide visual proof showing the product condition, expiry label, or receipt if available.
            </p>
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
                  <span>{uploadingImage ? 'Uploading Evidence Photo...' : 'Submitting Dispute...'}</span>
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

