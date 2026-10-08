import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * AdminEmptyState
 * Reusable zero-state display for administrative modules, tables, logs, and moderation queues.
 * Free of hardcoded domain strings; allows full customization via props.
 */
export const AdminEmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no active entries matching your current filters or system criteria.',
  contextMessage,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-3xl border-2 border-dashed border-gray-200 p-8 sm:p-12 text-center max-w-2xl mx-auto my-6 ${className}`}
    >
      {/* Icon Capsule */}
      <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-4 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shadow-sm">
        <Icon className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
      </div>

      {/* Title */}
      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto leading-relaxed mb-4 font-normal">
        {description}
      </p>

      {/* Optional Context Message / Alert Chip */}
      {contextMessage && (
        <div className="inline-block mb-5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-[11px] font-semibold text-gray-600">
          {contextMessage}
        </div>
      )}

      {/* Optional Action Button */}
      {actionLabel && onAction && (
        <div>
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition duration-150 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2"
          >
            {ActionIcon && <ActionIcon className="w-4 h-4" aria-hidden="true" />}
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminEmptyState;

