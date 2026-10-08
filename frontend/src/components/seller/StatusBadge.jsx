import React from 'react';

const STATUS_DICTIONARY = {
  // Expiry / Health States
  CRITICAL: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    defaultLabel: 'Critical (< 3d)',
    pulse: true,
  },
  URGENT: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    defaultLabel: 'Urgent (3–7d)',
    pulse: false,
  },
  APPROACHING_EXPIRY: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    defaultLabel: 'Approaching Expiry',
    pulse: false,
  },
  SAFE: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    defaultLabel: 'Safe Shelf Life',
    pulse: false,
  },
  HEALTHY: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    defaultLabel: 'Healthy Stock',
    pulse: false,
  },
  EXPIRED: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
    defaultLabel: 'Expired (Locked)',
    pulse: false,
  },

  // Order Lifecycle States
  PLACED: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    defaultLabel: 'Placed',
    pulse: false,
  },
  CONFIRMED: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    defaultLabel: 'Confirmed',
    pulse: false,
  },
  PACKED: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    defaultLabel: 'Packed & Staged',
    pulse: false,
  },
  READY_FOR_PICKUP: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    defaultLabel: 'Ready for Pickup',
    pulse: true,
  },
  OUT_FOR_DELIVERY: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    defaultLabel: 'Out for Delivery',
    pulse: false,
  },
  DELIVERED: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-600',
    defaultLabel: 'Delivered',
    pulse: false,
  },
  CANCELLED: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    defaultLabel: 'Cancelled',
    pulse: false,
  },

  // Payment / Billing States
  PAID: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-600',
    defaultLabel: 'Paid & Settled',
    pulse: false,
  },
  PENDING: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    defaultLabel: 'Payment Pending',
    pulse: false,
  },
  FAILED: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    defaultLabel: 'Payment Failed',
    pulse: false,
  },
  REFUNDED: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
    defaultLabel: 'Refunded',
    pulse: false,
  },

  // Catalog / Batch States
  ACTIVE: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    defaultLabel: 'Active',
    pulse: false,
  },
  INACTIVE: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    defaultLabel: 'Inactive',
    pulse: false,
  },
  OUT_OF_STOCK: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    defaultLabel: 'Out of Stock',
    pulse: false,
  },
  LOCKED: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
    defaultLabel: 'Locked',
    pulse: false,
  },

  // QR / Verification States
  GENUINE_ACTIVE: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    dot: 'bg-emerald-600',
    defaultLabel: 'Genuine Active Lot',
    pulse: false,
  },
  GENUINE_CRITICAL: {
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-300',
    dot: 'bg-rose-600',
    defaultLabel: 'Genuine Critical Lot',
    pulse: true,
  },
  REVOKED: {
    bg: 'bg-rose-100',
    text: 'text-rose-900',
    border: 'border-rose-300',
    dot: 'bg-rose-700',
    defaultLabel: 'Revoked QR Token',
    pulse: false,
  },
  VERIFIED: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    dot: 'bg-emerald-600',
    defaultLabel: 'Verified',
    pulse: false,
  },
};

const SIZE_CONFIG = {
  sm: 'text-[11px] px-2.5 py-0.5 gap-1.5',
  md: 'text-xs px-3 py-1 gap-1.5',
  lg: 'text-sm px-3.5 py-1.5 gap-2',
};

/**
 * StatusBadge
 * Unified production status badge for NearExpiry merchant portal.
 *
 * @param {string} status - Key matching status dictionary (case-insensitive)
 * @param {string} label - Optional override for badge text
 * @param {'sm'|'md'|'lg'} size - Badge sizing
 * @param {boolean} showDot - Whether to render the status dot
 * @param {boolean} pulse - Optional pulse animation override
 * @param {string} className - Optional additional CSS classes
 */
export const StatusBadge = ({
  status,
  label,
  size = 'sm',
  showDot = true,
  pulse,
  className = '',
}) => {
  if (!status) return null;

  const normalized = String(status).toUpperCase();
  const config = STATUS_DICTIONARY[normalized] || {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    defaultLabel: status,
    pulse: false,
  };

  const shouldPulse = pulse !== undefined ? pulse : config.pulse;
  const sizeClasses = SIZE_CONFIG[size] || SIZE_CONFIG.sm;

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          {shouldPulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`} />
        </span>
      )}
      <span className="truncate">{label || config.defaultLabel}</span>
    </span>
  );
};

