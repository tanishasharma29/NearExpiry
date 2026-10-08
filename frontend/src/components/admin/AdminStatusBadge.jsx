import React from 'react';

/**
 * AdminStatusBadge
 * Consistent semantic status indicator for all administrative entities,
 * including user accounts, seller KYC, product listings, orders, and system logs.
 */
const STATUS_CONFIGS = {
  // Green / Healthy / Approved
  ACTIVE: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  HEALTHY: { label: 'Healthy', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  COMPLETED: { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  RESOLVED: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  PAID: { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },

  // Amber / Warning / In Review
  PENDING: { label: 'Pending Review', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  WARNING: { label: 'Warning', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  INVESTIGATING: { label: 'Investigating', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  APPROACHING_EXPIRY: { label: 'Approaching Expiry', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  PACKED: { label: 'Packed', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },

  // Red / Critical / Rejected / Failed
  CRITICAL: { label: 'Critical Risk', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  SUSPENDED: { label: 'Suspended', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  FAILED: { label: 'Failed', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  REFUNDED: { label: 'Refunded', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  EXPIRED: { label: 'Expired', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },

  // Blue / Informational
  OPEN: { label: 'Open', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  PLACED: { label: 'Placed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  DRAFT: { label: 'Draft', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },

  // Gray / Neutral / Inactive
  INACTIVE: { label: 'Inactive', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' },
  ARCHIVED: { label: 'Archived', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' },
  DELISTED: { label: 'Delisted', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' },
  NEUTRAL: { label: 'Neutral', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' },
};

export const AdminStatusBadge = ({
  status,
  label,
  showDot = true,
  size = 'md',
  className = '',
}) => {
  const normalizedKey = String(status || 'NEUTRAL').toUpperCase().replace(/[\s-]/g, '_');
  const config = STATUS_CONFIGS[normalizedKey] || {
    label: status || 'Unknown',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
  };

  const displayText = label || config.label;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1 font-semibold',
    md: 'text-[11px] px-2.5 py-1 gap-1.5 font-bold',
    lg: 'text-xs px-3 py-1.5 gap-2 font-bold',
  }[size] || 'text-[11px] px-2.5 py-1 gap-1.5 font-bold';

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide whitespace-nowrap transition-colors duration-150 ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  );
};

export default AdminStatusBadge;

