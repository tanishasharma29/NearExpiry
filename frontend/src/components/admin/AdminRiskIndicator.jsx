import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Flame } from 'lucide-react';

/**
 * AdminRiskIndicator
 * Platform-wide risk gauge supporting LOW, MODERATE, HIGH, and CRITICAL classifications.
 * Useful for Global Inventory Radar, Store Risk Matrices, and Security/Expiry Alerts.
 */
const RISK_LEVELS = {
  LOW: {
    label: 'Low Risk',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    icon: ShieldCheck,
    barFill: 'bg-emerald-500',
  },
  MODERATE: {
    label: 'Moderate Risk',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    icon: AlertTriangle,
    barFill: 'bg-blue-500',
  },
  HIGH: {
    label: 'High Risk',
    color: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    icon: AlertTriangle,
    barFill: 'bg-amber-500',
  },
  CRITICAL: {
    label: 'Critical Risk',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badgeBg: 'bg-red-100',
    icon: AlertOctagon,
    barFill: 'bg-red-600',
  },
};

export const AdminRiskIndicator = ({
  level = 'LOW',
  value,
  label,
  subtext,
  variant = 'badge', // 'badge' | 'compact' | 'card' | 'bar'
  className = '',
}) => {
  const normalizedKey = String(level).toUpperCase();
  const config = RISK_LEVELS[normalizedKey] || RISK_LEVELS.LOW;
  const Icon = config.icon;
  const displayLabel = label || config.label;

  // Variant: Compact Pill / Dot
  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.bg} ${config.color} ${config.border} ${className}`}
        aria-label={`${displayLabel}${value !== undefined ? `: ${value}` : ''}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.barFill}`} aria-hidden="true" />
        <span>{displayLabel}</span>
        {value !== undefined && <span className="opacity-80">({value})</span>}
      </span>
    );
  }

  // Variant: Semantic Badge with Icon
  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border tracking-wide ${config.bg} ${config.color} ${config.border} ${className}`}
        aria-label={`${displayLabel}${value !== undefined ? `: ${value}` : ''}`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{displayLabel}</span>
        {value !== undefined && (
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${config.badgeBg}`}>
            {value}
          </span>
        )}
      </span>
    );
  }

  // Variant: Full Metric Card
  if (variant === 'card') {
    return (
      <div
        className={`p-4 rounded-2xl border ${config.bg} ${config.border} space-y-2 ${className}`}
        aria-label={`${displayLabel} overview`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
            {displayLabel}
          </span>
          <div className={`p-1.5 rounded-xl ${config.badgeBg} ${config.color}`}>
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        {value !== undefined && (
          <div className={`text-2xl font-black ${config.color} tracking-tight`}>
            {value}
          </div>
        )}
        {subtext && (
          <p className="text-[11px] text-gray-500 font-medium">
            {subtext}
          </p>
        )}
      </div>
    );
  }

  // Variant: Progress Bar representation
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className={config.color}>{displayLabel}</span>
        {value !== undefined && <span className="text-gray-700">{value}</span>}
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${config.barFill} rounded-full transition-all duration-300`} style={{ width: '100%' }} />
      </div>
    </div>
  );
};

export default AdminRiskIndicator;

