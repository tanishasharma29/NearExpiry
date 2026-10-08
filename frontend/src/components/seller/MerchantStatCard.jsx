import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const VARIANT_STYLES = {
  emerald: {
    accent: 'border-l-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  navy: {
    accent: 'border-l-slate-900',
    iconBg: 'bg-slate-100 text-slate-800 border-slate-200',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  amber: {
    accent: 'border-l-amber-500',
    iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  rose: {
    accent: 'border-l-rose-500',
    iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  sky: {
    accent: 'border-l-sky-500',
    iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  default: {
    accent: 'border-l-slate-300',
    iconBg: 'bg-slate-50 text-slate-600 border-slate-200',
    badge: 'bg-slate-50 text-slate-700 border-slate-200',
  },
};

/**
 * MerchantStatCard
 * Production-grade KPI metric card for NearExpiry merchant analytics and control centers.
 * Structure:
 * - Top row: Label & status badge on the left, icon badge on the right
 * - Dedicated full-width value row (zero icon collision, full currency visibility)
 * - Bottom row: Subtitle context and trend indicators
 *
 * @param {string} label - Metric name (e.g. "Total Units Rescued")
 * @param {string|number} value - Formatted value (e.g. "₹24,500" or "142")
 * @param {string|React.ReactNode} subtext - Supporting secondary text or calculation notes
 * @param {React.ComponentType} icon - Lucide icon
 * @param {'emerald'|'navy'|'amber'|'rose'|'sky'|'default'} variant - Semantic visual theme
 * @param {{ value: string|number, isPositive?: boolean, label?: string }} trend - Optional trend indicator
 * @param {string|React.ReactNode} badge - Optional status chip
 * @param {Function} onClick - Optional click handler
 */
export const MerchantStatCard = ({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
  trend,
  badge,
  onClick,
  className = '',
}) => {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm border-l-4 ${styles.accent} transition-all duration-200 flex flex-col justify-between ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'hover:border-slate-300'
      } ${className}`}
    >
      <div>
        {/* Top Header Row: Label + Badge (Left) and Icon (Right) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">
              {label}
            </span>
            {badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${styles.badge}`}>
                {badge}
              </span>
            )}
          </div>

          {Icon && (
            <div className={`p-2 rounded-lg border flex-shrink-0 ${styles.iconBg}`}>
              <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
          )}
        </div>

        {/* Dedicated Full-Width Value Row (Guaranteed No Overlap with Icon) */}
        <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight break-words py-1">
          {value ?? '—'}
        </div>
      </div>

      {/* Bottom Context Row: Subtext & Trend Indicator */}
      {(subtext || trend) && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          {subtext && <div className="truncate text-[11px]">{subtext}</div>}

          {trend && (
            <div
              className={`flex items-center gap-1 font-semibold flex-shrink-0 text-[11px] ${
                trend.isPositive === true
                  ? 'text-emerald-600'
                  : trend.isPositive === false
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {trend.isPositive === true && <TrendingUp className="w-3.5 h-3.5" />}
              {trend.isPositive === false && <TrendingDown className="w-3.5 h-3.5" />}
              {trend.isPositive === undefined && <Minus className="w-3.5 h-3.5" />}
              <span>{trend.value}</span>
              {trend.label && <span className="text-[10px] text-slate-400 font-normal">({trend.label})</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
