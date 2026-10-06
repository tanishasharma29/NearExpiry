import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, ShieldAlert, Check } from 'lucide-react';
import { ExpiryBadge } from './ExpiryBadge';
import { PriceTag } from './PriceTag';
import { StockBadge } from './StockBadge';
import { DistanceBadge } from './DistanceBadge';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';

const getProductImage = (product) => {
  const img = product?.image || product?.imageUrl || (Array.isArray(product?.images) && product.images[0]);
  if (img && typeof img === 'string' && !img.includes('placehold.co')) {
    return img;
  }
  const name = (product?.name || '').toLowerCase();
  const cat = (product?.category?.name || product?.category || '').toLowerCase();
  
  if (name.includes('protein') || name.includes('bar')) {
    return 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('granola') || name.includes('oat') || name.includes('cereal')) {
    return 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('biscuit') || name.includes('cookie') || name.includes('quinoa') || name.includes('chia')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('almond') || name.includes('nut')) {
    return 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('date') || name.includes('fig')) {
    return 'https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('dish') || name.includes('detergent') || name.includes('cleaner') || name.includes('towel') || name.includes('paper') || cat.includes('household')) {
    return 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('tea') || name.includes('honey') || name.includes('wellness') || name.includes('drink') || cat.includes('wellness')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('hair') || name.includes('oil')) {
    return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('shampoo') || name.includes('serum') || name.includes('beauty') || name.includes('wash') || cat.includes('beauty')) {
    return 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('yogurt') || name.includes('milk') || name.includes('cheese') || name.includes('dairy')) {
    return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80';
  }
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
};

export const ProductCard = ({ product }) => {
  const { addToCart, loading: cartLoading } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated, isCustomer } = useAuth();

  const primaryBatch = product.primaryBatch || product.earliestBatch || product.leadBatch || {};
  const currentPrice = product.effectivePrice ?? primaryBatch.currentPrice ?? product.pricingAndInventory?.fefoPrice ?? product.pricingAndInventory?.lowestPrice;
  const originalPrice = product.basePrice ?? primaryBatch.originalPrice ?? product.pricingAndInventory?.originalPrice ?? product.pricingAndInventory?.highestOriginalPrice;
  const discountPercentage = product.discountPercentage ?? primaryBatch.discountPercentage ?? product.pricingAndInventory?.fefoDiscountPercentage ?? product.pricingAndInventory?.highestDiscountPercentage;
  const remainingDays = primaryBatch.remainingDays ?? product.remainingDays ?? product.pricingAndInventory?.minRemainingDays;
  const batchStatus = primaryBatch.status ?? product.batchStatus ?? product.pricingAndInventory?.expiryStatus;
  const totalQuantity = product.totalQuantity ?? primaryBatch.quantity ?? product.pricingAndInventory?.totalAvailableQuantity;

  const [addedAnimation, setAddedAnimation] = useState(false);
  const [wishlistAnimation, setWishlistAnimation] = useState(false);

  const inWish = isInWishlist(product._id);

  const handleWishlistToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlistAnimation(true);
    setTimeout(() => setWishlistAnimation(false), 500);
    try {
      if (inWish) {
        await removeFromWishlist(product._id);
      } else {
        await addToWishlist(product);
      }
    } catch (err) {
      console.warn('Failed to toggle wishlist:', err);
    }
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPurchasable) return;
    try {
      setAddedAnimation(true);
      await addToCart(product, 1);
      setTimeout(() => setAddedAnimation(false), 1200);
    } catch (err) {
      console.warn('Failed to add item to cart:', err);
    }
  };

  const isPurchasable = product.isPurchasable !== false && (totalQuantity > 0 || (currentPrice !== undefined && currentPrice !== null));

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
      {/* Top Media Area */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        <img
          src={getProductImage(product)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
          }}
        />

        {/* Expiry Badge overlay */}
        <div className="absolute top-2 left-2 z-10">
          <ExpiryBadge
            remainingDays={remainingDays}
            status={batchStatus}
          />
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          className={`absolute top-2 right-2 p-1.5 rounded-full shadow-md transition-all duration-200 z-20 ${
            wishlistAnimation ? 'scale-125' : 'hover:scale-110 active:scale-90'
          } ${
            inWish
              ? 'bg-red-50 text-red-500 border border-red-200 shadow-red-500/20'
              : 'bg-white/90 backdrop-blur-sm text-gray-500 hover:text-red-500 hover:bg-white'
          }`}
          title={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-label={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 transition-transform duration-200 ${inWish ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Brand & Category */}
        <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">
          {product.brand || product.category?.name || 'Hyperlocal Grocery'}
        </div>

        {/* Product Name */}
        <Link to={`/product/${product._id}`} className="hover:text-brand-600 transition">
          <h3 className="font-semibold text-gray-900 text-base line-clamp-1" title={product.name}>
            {product.name}
          </h3>
        </Link>

        {/* Package info */}
        <div className="text-xs text-gray-500 mb-2">
          {product.packageSize ? `${product.packageSize} • ` : ''}{product.unit || 'pack'}
        </div>

        {/* Store & Distance Badge */}
        <div className="mb-3">
          <DistanceBadge
            distanceKm={product.distanceKm ?? product.distance}
            storeName={product.store?.storeName || product.storeId?.storeName}
            city={product.store?.address?.city}
          />
        </div>

        {/* Price & Stock Row */}
        <div className="mt-auto pt-3 border-t border-gray-100 flex items-end justify-between">
          <div>
            <PriceTag
              currentPrice={currentPrice}
              originalPrice={originalPrice}
              discountPercentage={discountPercentage}
            />
            <div className="mt-1">
              <StockBadge
                quantity={totalQuantity}
                isPurchasable={isPurchasable}
              />
            </div>
          </div>

          {/* Quick Add Button */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!isPurchasable || cartLoading}
            className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm ${
              addedAnimation
                ? 'bg-emerald-600 text-white scale-105 shadow-md ring-2 ring-emerald-300'
                : isPurchasable
                ? 'bg-brand-600 hover:bg-brand-700 active:scale-95 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title={
              addedAnimation
                ? 'Added to cart!'
                : isPurchasable
                ? 'Add 1 to Cart'
                : 'Item is expired or out of stock'
            }
            aria-label="Add to cart"
          >
            {addedAnimation ? (
              <Check className="w-4 h-4 animate-in zoom-in" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

