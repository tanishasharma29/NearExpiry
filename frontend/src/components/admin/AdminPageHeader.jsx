import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * AdminPageHeader
 * Unified, responsive header for all NearExpiry Admin Portal command modules.
 * Supports section eyebrow, page title, operational subtitle, breadcrumbs,
 * dynamic status/command chips, and right-side action buttons.
 */
export const AdminPageHeader = ({
  eyebrow,
  title,
  subtitle,
  breadcrumbs = [],
  statusBadge,
  actions,
  className = '',
}) => {
  return (
    <div className={`space-y-3 pb-6 border-b border-gray-200 ${className}`}>
      {/* Optional Breadcrumb Trail */}
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label || idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-purple-700 transition focus:outline-none focus:ring-1 focus:ring-purple-500 rounded px-1"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className={idx === breadcrumbs.length - 1 ? 'text-gray-900 font-semibold' : ''}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Header Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          {/* Eyebrow / Domain Category */}
          {eyebrow && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-md">
                {eyebrow}
              </span>
              {statusBadge && <div className="inline-flex items-center">{statusBadge}</div>}
            </div>
          )}

          {/* Title & Badge */}
          <div className="flex items-center flex-wrap gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              {title}
            </h1>
            {!eyebrow && statusBadge && (
              <div className="inline-flex items-center">{statusBadge}</div>
            )}
          </div>

          {/* Subtitle / Operational Intent */}
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 max-w-3xl leading-relaxed font-normal">
              {subtitle}
            </p>
          )}
        </div>

        {/* Action Controls */}
        {actions && (
          <div className="flex items-center flex-wrap gap-2.5 self-start md:self-center flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPageHeader;

