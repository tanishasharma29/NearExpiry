import React from 'react';

/**
 * PriceTag
 * Clearly renders Current Price, Original Strikethrough Price, and Discount Percentage.
 * Always renders server-authoritative numbers.
 */
export const PriceTag = ({ originalPrice, currentPrice, discountPercentage, size = 'md' }) => {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';
  const hasDiscount = Number(discountPercentage) > 0;

  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      {/* Current Price */}
      <span className={`font-black text-gray-900 ${isLarge ? 'text-2xl' : isSmall ? 'text-base' : 'text-xl'}`}>
        ₹{Number(currentPrice || 0).toFixed(2)}
      </span>

      {/* Strikethrough Original Price */}
      {hasDiscount && (
        <span className={`text-gray-400 line-through ${isLarge ? 'text-base' : 'text-xs'}`}>
          ₹{Number(originalPrice || 0).toFixed(2)}
        </span>
      )}

      {/* Discount Badge */}
      {hasDiscount && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
          {discountPercentage}% OFF
        </span>
      )}
    </div>
  );
};
