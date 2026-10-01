import React from 'react';
import { AlertTriangle, Clock, ShieldCheck, XCircle } from 'lucide-react';

/**
 * ExpiryBadge
 * Displays remaining expiry without running custom date math in React.
 * Uses 'remainingDays' and 'status' directly from the authoritative backend.
 */
export const ExpiryBadge = ({ remainingDays, status, size = 'sm' }) => {
  const isSmall = size === 'sm';
  const sizeClasses = isSmall ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  // 1. Expired
  if (remainingDays < 0 || status === 'EXPIRED') {
    return (
      <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-300 ${sizeClasses}`}>
        <XCircle className={isSmall ? 'w-3 h-3 text-gray-500' : 'w-4 h-4 text-gray-500'} />
        Expired / Locked
      </span>
    );
  }

  // 2. Critical (0 - 2 Days)
  if (remainingDays <= 2 || status === 'CRITICAL') {
    return (
      <span className={`inline-flex items-center gap-1 font-bold rounded-full bg-red-100 text-red-700 border border-red-300 animate-pulse ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
        <AlertTriangle className={isSmall ? 'w-3 h-3 text-red-600' : 'w-4 h-4 text-red-600'} />
        {remainingDays === 0 ? 'Expires Today!' : `${remainingDays}d left (Critical)`}
      </span>
    );
  }

  // 3. Urgent (3 - 7 Days)
  if (remainingDays <= 7) {
    return (
      <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-orange-100 text-orange-800 border border-orange-300 ${sizeClasses}`}>
        <Clock className={isSmall ? 'w-3 h-3 text-orange-600' : 'w-4 h-4 text-orange-600'} />
        {`${remainingDays}d left (Urgent)`}
      </span>
    );
  }

  // 4. Approaching (8 - 15 Days)
  if (remainingDays <= 15 || status === 'APPROACHING_EXPIRY') {
    return (
      <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-amber-100 text-amber-900 border border-amber-300 ${sizeClasses}`}>
        <Clock className={isSmall ? 'w-3 h-3 text-amber-600' : 'w-4 h-4 text-amber-600'} />
        {`${remainingDays}d left`}
      </span>
    );
  }

  // 5. Moderate (16 - 30 Days)
  if (remainingDays <= 30) {
    return (
      <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}>
        <Clock className={isSmall ? 'w-3 h-3 text-blue-500' : 'w-4 h-4 text-blue-500'} />
        {`${remainingDays}d shelf life`}
      </span>
    );
  }

  // 6. Safe (31+ Days)
  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
      <ShieldCheck className={isSmall ? 'w-3 h-3 text-emerald-600' : 'w-4 h-4 text-emerald-600'} />
      {`${remainingDays}d (Fresh)`}
    </span>
  );
};
