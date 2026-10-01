import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, Store, Calendar, ShieldCheck, AlertCircle, ArrowLeft, PackageCheck, Layers } from 'lucide-react';
import { productService } from '../../services/productService';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { PriceTag } from '../../components/common/PriceTag';
import { StockBadge } from '../../components/common/StockBadge';
import { DistanceBadge } from '../../components/common/DistanceBadge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';

export const ProductDetailsPage = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated, isCustomer } = useAuth();

  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        setLoading(true);
        const resData = await productService.getMarketplaceProductById(id);
        setData(resData);
      } catch (err) {
        console.error('Failed to load product details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProductDetails();
  }, [id]);

  if (loading) return <LoadingSpinner text="Retrieving batch information from server..." />;
  if (!data || !data.product) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-gray-900">Product not found</h2>
        <Link to="/marketplace" className="text-brand-600 font-semibold mt-4 inline-block">
          Return to Marketplace
        </Link>
      </div>
    );
  }

  const { product, activeBatches = [], primaryBatch = {}, store } = data;
  const inWish = isInWishlist(product._id);
  const totalStock = activeBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
  const isPurchasable = product.isPurchasable !== false && totalStock > 0;

  const handleAddToCart = async () => {
    if (!isAuthenticated) return alert('Please sign in to add items to your cart');
    if (!isCustomer) return alert('Only customers can purchase items');
    try {
      setAddingToCart(true);
      await addToCart(product._id, quantity);
      alert(`Added ${quantity} item(s) to cart!`);
    } catch (err) {
      alert(err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlistToggle = () => {
    if (!isAuthenticated) return alert('Please sign in to manage wishlist');
    if (inWish) {
      removeFromWishlist(product._id);
    } else {
      addToWishlist(product._id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-600 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Marketplace
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
        {/* Left: Product Image & Badges */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
            <img
              src={product.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3">
              <ExpiryBadge
                remainingDays={primaryBatch.remainingDays ?? product.remainingDays}
                status={primaryBatch.status ?? product.batchStatus}
                size="md"
              />
            </div>
            <button
              onClick={handleWishlistToggle}
              className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-full text-gray-600 hover:text-red-500 shadow transition"
            >
              <Heart className={`w-5 h-5 ${inWish ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Right: Product & Expiry Pricing Breakdown */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="text-xs font-bold text-brand-700 uppercase tracking-wider">
              {product.brand || 'Verified Retailer'} • {product.category?.name || 'Grocery'}
            </div>
            <h1 className="text-3xl font-black text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>

            <div className="pt-2 flex items-center gap-4">
              <DistanceBadge
                distanceKm={product.distanceKm ?? product.distance}
                storeName={store?.storeName || product.storeId?.storeName}
                city={store?.address?.city}
              />
              <StockBadge quantity={totalStock} isPurchasable={isPurchasable} />
            </div>

            {/* Dynamic Price Box */}
            <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-200 space-y-2">
              <div className="text-xs font-semibold text-brand-800 uppercase">
                Active Dynamic Price (FEFO Algorithm)
              </div>
              <PriceTag
                currentPrice={primaryBatch.currentPrice ?? product.effectivePrice}
                originalPrice={primaryBatch.originalPrice ?? product.basePrice}
                discountPercentage={primaryBatch.discountPercentage ?? product.discountPercentage}
                size="lg"
              />
              <p className="text-xs text-brand-700">
                ⚡ Discount automatically applied based on remaining shelf life. Price will never increase.
              </p>
            </div>
          </div>

          {/* Add to Cart Actions */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            {isPurchasable ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-gray-300 rounded-xl bg-gray-50 p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-sm">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(totalStock, q + 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {addingToCart ? 'Adding...' : `Add ${quantity} to Cart`}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-gray-100 rounded-xl text-center text-sm font-semibold text-gray-500">
                This item is currently out of stock or marked expired.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FEFO Batch Transparency Table */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-bold text-gray-900">Active FEFO Batches & Expiry Horizons</h2>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            Allocated First-Expired-First-Out by Backend
          </span>
        </div>

        {activeBatches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Remaining Shelf Life</th>
                  <th className="py-3 px-4">Original Price</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Dynamic Price</th>
                  <th className="py-3 px-4">Available Units</th>
                  <th className="py-3 px-4">Purchasable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeBatches.map((b) => (
                  <tr key={b._id} className="hover:bg-gray-50 transition font-medium">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900">{b.batchNumber}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(b.expiryDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <ExpiryBadge remainingDays={b.remainingDays} status={b.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-400 line-through">₹{Number(b.originalPrice).toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold text-green-700">{b.discountPercentage}% OFF</td>
                    <td className="py-3 px-4 font-black text-gray-900">₹{Number(b.currentPrice).toFixed(2)}</td>
                    <td className="py-3 px-4 font-semibold text-gray-800">{b.quantity}</td>
                    <td className="py-3 px-4">
                      {b.isPurchasable !== false && b.quantity > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold">
                          <PackageCheck className="w-3 h-3" /> Sellable
                        </span>
                      ) : (
                        <span className="text-gray-400 font-semibold">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-500">No active batches registered for this catalog item.</p>
        )}
      </div>
    </div>
  );
};
