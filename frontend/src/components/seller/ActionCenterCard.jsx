import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertCircle, AlertTriangle, Clock, CheckCircle2, Info } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-rose-50/70',
    border: 'border-rose-200',
    accent: 'bg-rose-500',
    text: 'text-rose-900',
    descText: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    btn: 'bg-rose-600 hover:bg-rose-700 text-white',
    defaultIcon: AlertCircle,
  },
  warning: {
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    accent: 'bg-amber-500',
    text: 'text-amber-900',
    descText: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white',
    defaultIcon: AlertTriangle,
  },
  info: {
    bg: 'bg-sky-50/70',
    border: 'border-sky-200',
    accent: 'bg-sky-500',
    text: 'text-sky-900',
    descText: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    btn: 'bg-sky-600 hover:bg-sky-700 text-white',
    defaultIcon: Info,
  },
  success: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    accent: 'bg-emerald-500',
    text: 'text-emerald-900',
    descText: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    defaultIcon: CheckCircle2,
  },
};

/**
 * ActionCenterCard
 * Surfaces actionable tasks and warnings in the Merchant Command Center.
 *
 * @param {string} title - Heading summary (e.g. "2 batches expire today")
 * @param {string} description - Operational context
 * @param {string} actionLabel - Button CTA label (e.g. "View Batches")
 * @param {string} actionLink - Router path to the relevant module
 * @param {Function} onAction - Optional callback handler if not navigating
 * @param {'critical'|'warning'|'info'|'success'} severity - Priority level
 * @param {number|string} count - Optional badge counter
 * @param {React.ComponentType} icon - Custom icon (defaults to severity icon)
 * @param {string|React.ReactNode} metadata - Optional detail timestamp or lot number
 */
export const ActionCenterCard = ({
  title,
  description,
  actionLabel = 'Review',
  actionLink,
  onAction,
  severity = 'info',
  count,
  icon: CustomIcon,
  metadata,
}) => {
  const conf = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
  const IconComponent = CustomIcon || conf.defaultIcon;

  return (
    <div
      className={`relative rounded-xl border ${conf.border} ${conf.bg} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-sm`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className={`p-2.5 rounded-lg bg-white shadow-xs border ${conf.border} flex-shrink-0 mt-0.5`}>
          <IconComponent className={`w-5 h-5 ${conf.text}`} />
        </div>

        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-sm font-bold ${conf.text} tracking-tight`}>
              {title}
            </h4>
            {count !== undefined && count !== null && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${conf.badge}`}>
                {count} {typeof count === 'number' && count === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          {description && (
            <p className={`text-xs ${conf.descText} leading-relaxed max-w-xl`}>
              {description}
            </p>
          )}
          {metadata && (
            <div className="text-[11px] text-slate-500 font-mono pt-0.5">
              {metadata}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 sm:self-center">
        {actionLink ? (
          <Link
            to={actionLink}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition ${conf.btn}`}
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : onAction ? (
          <button
            onClick={onAction}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition ${conf.btn}`}
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

