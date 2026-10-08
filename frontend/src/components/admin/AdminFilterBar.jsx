import React from 'react';
import { Search, X, RotateCcw, Filter } from 'lucide-react';

/**
 * AdminFilterBar
 * Universal responsive filtering, search, and criteria control bar for Admin tables and lists.
 * Highly configurable, contains zero business logic, and adapts seamlessly across mobile & desktop.
 */
export const AdminFilterBar = ({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [],
  dateFilter,
  totalResults,
  filteredCount,
  onClear,
  hasActiveFilters = false,
  className = '',
  extraActions,
}) => {
  return (
    <div
      className={`bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 shadow-sm space-y-3 ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Input Container */}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full pl-9 pr-9 py-2 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-purple-600 rounded-xl text-xs font-medium text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-purple-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange && onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dynamic Filters & Date Picker Container */}
        <div className="flex flex-wrap items-center gap-2.5">
          {filters.map((filter) => {
            const FilterIcon = filter.icon || Filter;
            return (
              <div key={filter.id} className="relative flex-1 sm:flex-initial min-w-[130px]">
                <div className="relative flex items-center">
                  <select
                    id={`filter-${filter.id}`}
                    value={filter.value}
                    onChange={(e) => filter.onChange && filter.onChange(e.target.value)}
                    aria-label={filter.label}
                    className="w-full sm:w-auto appearance-none bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-purple-600 text-xs font-semibold text-gray-700 pl-8 pr-7 py-2 rounded-xl outline-none transition cursor-pointer focus:ring-2 focus:ring-purple-100"
                  >
                    {filter.options.map((opt) => (
                      <option key={String(opt.value)} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <FilterIcon
                    className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <div className="absolute right-2.5 pointer-events-none text-gray-400 text-[10px]">
                    ▼
                  </div>
                </div>
              </div>
            );
          })}

          {/* Optional Date Filter */}
          {dateFilter && (
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <input
                type="date"
                value={dateFilter.value}
                onChange={(e) => dateFilter.onChange && dateFilter.onChange(e.target.value)}
                aria-label={dateFilter.label || 'Filter by date'}
                className="bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-purple-600 text-xs font-medium text-gray-700 px-3 py-2 rounded-xl outline-none transition focus:ring-2 focus:ring-purple-100"
              />
            </div>
          )}

          {/* Clear Filters Reset Button */}
          {hasActiveFilters && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-red-700 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-red-100"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-600" />
              <span>Reset</span>
            </button>
          )}

          {extraActions}
        </div>
      </div>

      {/* Optional Result Counter Bar */}
      {(totalResults !== undefined || filteredCount !== undefined) && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500 font-medium">
          <div>
            Showing <span className="font-bold text-gray-800">{filteredCount ?? totalResults}</span>
            {totalResults !== undefined && filteredCount !== undefined && totalResults !== filteredCount && (
              <> of <span className="font-bold text-gray-800">{totalResults}</span> total records</>
            )}
          </div>
          {hasActiveFilters && (
            <span className="text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded text-[10px]">
              Filtered results
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminFilterBar;

