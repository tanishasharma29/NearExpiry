import React from 'react';
import { AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';

const TIERS = [
  { key: 'today', label: 'Expiring Today', color: 'bg-rose-600', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  { key: 'critical', label: '1–3 Days', color: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  { key: 'urgent', label: '4–7 Days', color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'approaching', label: '8–15 Days', color: 'bg-amber-400', text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'safe', label: '15+ Days', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'expired', label: 'Expired', color: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300' },
];

/**
 * RiskIndicator
 * Visual shelf-life risk thermometer & distribution widget.
 *
 * @param {'distribution'|'single'} mode - Distribution breakdown bar vs single batch meter
 * @param {Object} counts - Object containing tier counts { today, critical, urgent, approaching, safe, expired }
 * @param {number} days - Remaining calendar days for single batch mode
 * @param {string} status - Optional backend status string
 * @param {boolean} showLabels - Whether to display legend/labels
 * @param {string} className - Optional container styling
 */
export const RiskIndicator = ({
  mode = 'distribution',
  counts = {},
  days,
  status,
  showLabels = true,
  className = '',
}) => {
  // Mode 1: Single Batch Shelf-life Meter
  if (mode === 'single' || days !== undefined) {
    let tier = TIERS[4]; // Default: safe (15+ days)

    if (days < 0 || status === 'EXPIRED') {
      tier = TIERS[5]; // expired
    } else if (days === 0) {
      tier = TIERS[0]; // today
    } else if (days <= 3 || status === 'CRITICAL') {
      tier = TIERS[1]; // 1-3d
    } else if (days <= 7) {
      tier = TIERS[2]; // 4-7d
    } else if (days <= 15 || status === 'APPROACHING_EXPIRY') {
      tier = TIERS[3]; // 8-15d
    }

    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${tier.bg} ${tier.text} ${tier.border}`}
        >
          <span className={`w-2 h-2 rounded-full ${tier.color}`} />
          <span>
            {days < 0
              ? 'Expired'
              : days === 0
              ? 'Expires Today'
              : `${days}d remaining (${tier.label})`}
          </span>
        </span>
      </div>
    );
  }

  // Mode 2: Aggregate Risk Distribution Breakdown
  const safeCounts = {
    today: counts.today || 0,
    critical: counts.critical || 0,
    urgent: counts.urgent || 0,
    approaching: counts.approaching || 0,
    safe: counts.safe || 0,
    expired: counts.expired || 0,
  };

  const total = Object.values(safeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Segmented Risk Bar */}
      <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden border border-slate-200/80">
        {total > 0 ? (
          TIERS.map((tier) => {
            const count = safeCounts[tier.key] || 0;
            if (count === 0) return null;
            const pct = (count / total) * 100;
            return (
              <div
                key={tier.key}
                title={`${tier.label}: ${count} lots (${pct.toFixed(1)}%)`}
                style={{ width: `${pct}%` }}
                className={`${tier.color} transition-all duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-90`}
              />
            );
          })
        ) : (
          <div className="w-full h-full bg-slate-200 text-slate-400 text-[10px] flex items-center justify-center font-medium">
            No active batches recorded
          </div>
        )}
      </div>

      {/* Legend / Breakdown Grid */}
      {showLabels && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-xs">
          {TIERS.map((tier) => {
            const count = safeCounts[tier.key] || 0;
            return (
              <div
                key={tier.key}
                className={`p-2 rounded-xl border ${tier.bg} ${tier.border} flex flex-col justify-between`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${tier.color} flex-shrink-0`} />
                  <span className="text-[11px] font-semibold text-slate-600 truncate">
                    {tier.label}
                  </span>
                </div>
                <div className={`text-base font-black ${tier.text} mt-1`}>
                  {count} <span className="text-[10px] font-normal text-slate-500">lots</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

