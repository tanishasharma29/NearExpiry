import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const getItemImage = (item, product) => {
  const direct =
    item?.image ||
    product?.image ||
    product?.imageUrl ||
    (Array.isArray(product?.images) && product?.images[0]);

  const isBroken =
    !direct ||
    typeof direct !== 'string' ||
    direct.includes('placehold.co') ||
    direct.includes('photo-1622484216850') ||
    direct.includes('photo-1517093157656') ||
    direct.includes('photo-1608248597359');

  if (!isBroken) {
    return direct;
  }

  const name = (item?.productName || product?.name || '').toLowerCase();
  if (name.includes('protein') || name.includes('bar')) {
    return 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('granola') || name.includes('oat') || name.includes('cereal')) {
    return 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('biscuit') || name.includes('cookie') || name.includes('quinoa') || name.includes('chia') || name.includes('snack')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('almond') || name.includes('nut')) {
    return 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('date') || name.includes('fig')) {
    return 'https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('dish') || name.includes('cleaner') || name.includes('detergent') || name.includes('towel') || name.includes('paper')) {
    return 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('tea') || name.includes('honey') || name.includes('drink')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('hair') || name.includes('oil')) {
    return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('shampoo') || name.includes('serum') || name.includes('beauty') || name.includes('wash')) {
    return 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=300&q=80';
  }
  if (name.includes('yogurt') || name.includes('milk') || name.includes('cheese') || name.includes('dairy')) {
    return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=300&q=80';
  }
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80';
};

const handleImgError = (e, productName) => {
  e.target.onerror = null;
  const name = (productName || '').toLowerCase();
  if (name.includes('protein') || name.includes('bar')) {
    e.target.src = 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=300&q=80';
  } else if (name.includes('granola') || name.includes('oat') || name.includes('cereal')) {
    e.target.src = 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=300&q=80';
  } else if (name.includes('biscuit') || name.includes('cookie') || name.includes('quinoa') || name.includes('chia') || name.includes('snack')) {
    e.target.src = 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=300&q=80';
  } else if (name.includes('almond') || name.includes('nut')) {
    e.target.src = 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=300&q=80';
  } else if (name.includes('dish') || name.includes('cleaner') || name.includes('detergent')) {
    e.target.src = 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=300&q=80';
  } else if (name.includes('hair') || name.includes('oil')) {
    e.target.src = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80';
  } else {
    e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80';
  }
};

export const CartPage = () => {
  const { cart, loading, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  if (loading && !cart) return <LoadingSpinner text="Recalculating live cart totals..." />;

  const items = cart?.items || [];
  const pricing = cart?.pricingSummary || { subtotal: 0, discounts: 0, finalTotal: 0 };
  const warnings = cart?.warnings || [];

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Discover near-expiry grocery deals and rescue food while saving money!"
          actionLabel="Start Shopping"
          actionLink="/marketplace"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Your Shopping Cart</h1>
          <p className="text-sm text-gray-500">Live prices validated against current shelf life</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
        >
          Clear All Items
        </button>
      </div>

      {/* Price/Stock Warnings if any */}
      {warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Inventory & Price Updates Noticed:
          </div>
          {warnings.map((w, idx) => (
            <div key={idx}>• {w}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const product =
              (typeof item.productId === 'object' && item.productId !== null)
                ? item.productId
                : (item.product && typeof item.product === 'object' ? item.product : {});

            const productId =
              product._id ||
              (typeof item.productId === 'string' ? item.productId : item.productId?._id) ||
              item._id;

            const productName = item.productName || product.name || 'Product';
            const brand = item.brand || product.brand || 'NearExpiry';

            const effectivePrice = Number(
              item.effectivePrice ??
              item.currentPrice ??
              item.unitPrice ??
              item.pricing?.unitFinalPrice ??
              product.effectivePrice ??
              product.basePrice ??
              0
            );

            const originalPrice = Number(
              item.originalPrice ??
              item.pricing?.unitOriginalPrice ??
              product.basePrice ??
              effectivePrice
            );

            const quantity = Number(item.quantity ?? item.requestedQuantity ?? 1);
            const image = getItemImage(item, product);

            return (
              <div
                key={item._id || productId}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition"
              >
                <img
                  src={image}
                  alt={productName}
                  className="w-20 h-20 rounded-xl object-cover bg-gray-100 flex-shrink-0 border border-gray-100"
                  onError={(e) => handleImgError(e, productName)}
                />

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-brand-700 uppercase">{brand}</div>
                  <h3 className="font-bold text-gray-900 text-sm truncate">{productName}</h3>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-black text-gray-900 text-base">
                      ₹{effectivePrice.toFixed(2)}
                    </span>
                    {originalPrice > effectivePrice && (
                      <span className="text-xs text-gray-400 line-through">
                        ₹{originalPrice.toFixed(2)}
                      </span>
                    )}
                    {originalPrice > effectivePrice && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)}% OFF
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 p-1">
                    <button
                      onClick={() => updateQuantity(productId, Math.max(1, quantity - 1))}
                      className="w-7 h-7 rounded bg-white font-bold text-xs shadow-sm hover:bg-gray-100 transition"
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-bold">{quantity}</span>
                    <button
                      onClick={() => updateQuantity(productId, quantity + 1)}
                      className="w-7 h-7 rounded bg-white font-bold text-xs shadow-sm hover:bg-gray-100 transition"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(productId)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary Box */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4 h-fit">
          <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Catalog Subtotal</span>
              <span className="font-medium text-gray-900">₹{Number(pricing.subtotal || 0).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-green-700 font-semibold">
              <span>Near-Expiry Discounts</span>
              <span>-₹{Number(pricing.discounts || 0).toFixed(2)}</span>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-between text-base font-black text-gray-900">
              <span>Final Total</span>
              <span className="text-xl text-brand-700">₹{Number(pricing.finalTotal || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="p-3 bg-brand-50 rounded-xl text-xs text-brand-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0" />
            <span>Guaranteed FEFO allocation from authorized neighborhood store lot</span>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
          >
            Proceed to Checkout
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
