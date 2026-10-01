import React from 'react';
import { Heart } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { ProductCard } from '../../components/common/ProductCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const WishlistPage = () => {
  const { wishlist, loading } = useWishlist();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Saved Wishlist</h1>
        <p className="text-sm text-gray-500">
          Monitor your favorite items as their dynamic discounts increase closer to expiry
        </p>
      </div>

      {loading ? (
        <LoadingSpinner text="Fetching wishlist items..." />
      ) : wishlist.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {wishlist.map((item) => {
            const product = item.productId || item;
            return <ProductCard key={product._id} product={product} />;
          })}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Explore the marketplace and tap the heart icon on any product to track its live price drops."
          actionLabel="Explore Marketplace"
          actionLink="/marketplace"
        />
      )}
    </div>
  );
};
