import React from 'react';
import { Package } from 'lucide-react';

export const StockBadge = ({ quantity = 0, isPurchasable = true }) => {
  const qty = Number(quantity);

  if (qty <= 0 || !isPurchasable) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
        Out of Stock
      </span>
    );
  }

  if (qty <= 5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
        <Package className="w-3 h-3" />
        Only {qty} left!
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600 px-2 py-0.5 rounded bg-gray-100">
      <Package className="w-3 h-3 text-gray-400" />
      {qty} in stock
    </span>
  );
};
