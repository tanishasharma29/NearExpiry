import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * AdminExpandableRow
 * Accessible table row with smooth upward/downward animated expansion.
 * Used across Admin tables for inline inspection of KYC details, order breakdowns,
 * and before/after audit diffs without full page reloads.
 */
export const AdminExpandableRow = ({
  isExpanded,
  onToggle,
  colSpan = 6,
  renderCells,
  detailContent,
  className = '',
  detailClassName = '',
  expandButtonLabel = 'Toggle details',
}) => {
  return (
    <>
      {/* Primary Summary Row */}
      <tr
        onClick={onToggle}
        className={`group cursor-pointer transition-colors duration-150 ${
          isExpanded ? 'bg-purple-50/40 hover:bg-purple-50/60' : 'hover:bg-gray-50'
        } ${className}`}
      >
        {renderCells({
          isExpanded,
          expandButton: (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-expanded={isExpanded}
              aria-label={expandButtonLabel}
              className={`p-1.5 rounded-lg text-gray-400 group-hover:text-purple-700 hover:bg-purple-100/60 transition-transform duration-200 motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                isExpanded ? 'rotate-180 text-purple-700 bg-purple-100/70' : ''
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          ),
        })}
      </tr>

      {/* Expandable Detail Sub-Row */}
      {isExpanded && (
        <tr className="bg-gradient-to-b from-purple-50/20 to-gray-50/40">
          <td colSpan={colSpan} className="p-0 border-b border-gray-200">
            <div
              className={`p-4 sm:p-5 transition-all duration-200 ease-out motion-reduce:transition-none ${detailClassName}`}
            >
              {detailContent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default AdminExpandableRow;

