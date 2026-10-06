import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, ShieldAlert } from 'lucide-react';
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
  
  if (name.includes('protein') || name.includes('bar') || name.includes('granola') || name.includes('snack') || name.includes('almond') || name.includes('biscuit') || name.includes('date') || cat.includes('snack')) {
    return 'https://images.unsplash.com/photo-1622484216850-252a9261bf03?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('dish') || name.includes('detergent') || name.includes('cleaner') || name.includes('towel') || name.includes('paper') || cat.includes('household')) {
    return 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('tea') || name.includes('honey') || name.includes('wellness') || name.includes('drink') || cat.includes('wellness')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80';
  }
  if (name.includes('shampoo') || name.includes('serum') || name.includes('hair') || name.includes('beauty') || name.includes('wash') || cat.includes('beauty')) {
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

  const inWish = isInWishlist(product._id);

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    if (!isAuthenticated) return alert('Please log in to manage your wishlist');
    if (inWish) {
      removeFromWishlist(product._id);
    } else {
      addToWishlist(product._id);
    }
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return alert('Please log in as a customer to add items to your cart');
    if (!isCustomer) return alert('Only customers can purchase items');
    try {
      await addToCart(product._id, 1);
    } catch (err) {
      alert(err.message || 'Failed to add item to cart');
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
          onClick={handleWishlistToggle}
          className={`absolute top-2 right-2 p-1.5 rounded-full shadow-md transition ${
            inWish ? 'bg-red-50 text-red-500' : 'bg-white/80 backdrop-blur-sm text-gray-500 hover:text-red-500'
          }`}
          title={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 ${inWish ? 'fill-red-500' : ''}`} />
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
            onClick={handleAddToCart}
            disabled={!isPurchasable || cartLoading}
            className={`p-2.5 rounded-lg flex items-center justify-center transition shadow-sm ${
              isPurchasable
                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title={isPurchasable ? 'Add 1 to Cart' : 'Item is expired or out of stock'}
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

