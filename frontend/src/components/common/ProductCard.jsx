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

export const ProductCard = ({ product }) => {
  const { addToCart, loading: cartLoading } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated, isCustomer } = useAuth();

  const primaryBatch = product.primaryBatch || product.earliestBatch || {};
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

  const isPurchasable = product.isPurchasable !== false && (product.totalQuantity || primaryBatch.quantity) > 0;

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
      {/* Top Media Area */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        <img
          src={product.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />

        {/* Expiry Badge overlay */}
        <div className="absolute top-2 left-2 z-10">
          <ExpiryBadge
            remainingDays={primaryBatch.remainingDays ?? product.remainingDays}
            status={primaryBatch.status ?? product.batchStatus}
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
              currentPrice={product.effectivePrice ?? primaryBatch.currentPrice}
              originalPrice={product.basePrice ?? primaryBatch.originalPrice}
              discountPercentage={product.discountPercentage ?? primaryBatch.discountPercentage}
            />
            <div className="mt-1">
              <StockBadge
                quantity={product.totalQuantity ?? primaryBatch.quantity}
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
