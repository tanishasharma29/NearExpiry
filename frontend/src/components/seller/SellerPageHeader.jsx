import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';

/**
 * SellerPageHeader
 * Standardized command-center header for all NearExpiry seller hub pages.
 *
 * @param {string} title - Main page heading
 * @param {string|React.ReactNode} subtitle - Supporting description or context
 * @param {string} badge - Eyebrow category badge (e.g. "Inventory Control", "Expiry Rescue", "Business Intelligence")
 * @param {React.ReactNode} actions - Action buttons or filters slot
 * @param {boolean} showEngineStatus - Whether to display the dynamic pricing indicator
 * @param {Array<{label: string, href?: string}>} breadcrumbs - Optional breadcrumb path
 */
export const SellerPageHeader = ({
  title,
  subtitle,
  badge,
  actions,
  showEngineStatus = false,
  breadcrumbs = [],
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm mb-6 transition-all">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {badge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-slate-900 text-emerald-400 border border-slate-800">
              {badge}
            </span>
          )}
          {breadcrumbs.length > 0 && (
            <nav className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-slate-300">/</span>}
                  {crumb.href ? (
                    <a href={crumb.href} className="hover:text-slate-700 transition">
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-slate-600 font-semibold">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        {showEngineStatus && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dynamic Pricing Engine Active</span>
          </div>
        )}
      </div>

      {/* Main Row: Title & Action Slot */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 font-normal max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

