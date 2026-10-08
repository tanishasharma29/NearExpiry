import React from 'react';
import { Leaf, Sparkles, TrendingUp, ShieldCheck, IndianRupee, Package, ArrowUpRight } from 'lucide-react';

/**
 * RescuePerformanceWidget
 * Production-grade visual widget showcasing real-world inventory recovery & sustainability impact.
 *
 * @param {number} unitsRescued - Total units liquidated before expiry
 * @param {number} revenueGenerated - Total revenue earned from rescued lots (₹)
 * @param {number} markdownSavings - Total markdown discounts passed to consumers (₹)
 * @param {number} wastePreventedKg - Estimated kilograms or physical units of waste diverted
 * @param {number} rescueRatePercent - Optional percentage of inventory saved vs expired
 * @param {string} periodLabel - Context period (e.g. "Last 30 Days")
 * @param {string} className - Additional CSS classes
 */
export const RescuePerformanceWidget = ({
  unitsRescued = 0,
  revenueGenerated = 0,
  markdownSavings = 0,
  wastePreventedKg = 0,
  rescueRatePercent,
  periodLabel = 'Last 30 Days',
  className = '',
}) => {
  // Format helpers
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const calculatedRate =
    rescueRatePercent !== undefined && rescueRatePercent !== null
      ? Math.min(100, Math.max(0, Math.round(rescueRatePercent)))
      : null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 sm:p-7 border border-slate-800 shadow-md ${className}`}
    >
      {/* Decorative subtle background mesh */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-20 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Expiry Rescue Performance
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <Sparkles className="w-3 h-3" /> ESG Impact
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Capital recovered & physical waste prevented via NearExpiry dynamic pricing
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 border border-slate-700">
            {periodLabel}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-5">
        {/* Metric 1: Units Rescued */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span>Units Rescued</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {unitsRescued.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400/90 font-medium">
            Sold before expiration
          </div>
        </div>

        {/* Metric 2: Revenue Recovered */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
            <span>Recovered Capital</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {formatCurrency(revenueGenerated)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Earned from near-expiry lots
          </div>
        </div>

        {/* Metric 3: Markdown Savings Granted */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Customer Markdown</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {formatCurrency(markdownSavings)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Dynamic discounts applied
          </div>
        </div>

        {/* Metric 4: Waste Diverted */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Leaf className="w-3.5 h-3.5 text-teal-400" />
            <span>Waste Prevented</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {wastePreventedKg > 0 ? `${wastePreventedKg.toLocaleString('en-IN')} kg` : `${unitsRescued} units`}
          </div>
          <div className="text-[11px] text-teal-400/90 font-medium">
            Diverted from landfill disposal
          </div>
        </div>
      </div>

      {/* Rescue Rate Bar (if available) */}
      {calculatedRate !== null && (
        <div className="relative z-10 mt-6 pt-5 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Inventory Rescue Efficiency Rate
            </span>
            <span className="font-bold text-emerald-400">
              {calculatedRate}% Rescued
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${calculatedRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

