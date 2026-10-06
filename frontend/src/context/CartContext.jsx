import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cartService';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const GUEST_CART_KEY = 'nearexpiry_cart';

export const normalizeCartData = (cartData) => {
  if (!cartData) {
    return { items: [], pricingSummary: { subtotal: 0, discounts: 0, finalTotal: 0 } };
  }

  const items = (cartData.items || []).map((it) => {
    const product =
      (typeof it.productId === 'object' && it.productId !== null)
        ? it.productId
        : (it.product && typeof it.product === 'object' ? it.product : {});

    const productId =
      product._id ||
      (typeof it.productId === 'string' ? it.productId : it.productId?._id) ||
      it._id;

    const unitPrice = Number(
      it.effectivePrice ??
      it.currentPrice ??
      it.unitPrice ??
      it.pricing?.unitFinalPrice ??
      product.effectivePrice ??
      product.pricingAndInventory?.fefoPrice ??
      product.pricingAndInventory?.lowestPrice ??
      product.basePrice ??
      0
    );

    const originalPrice = Number(
      it.originalPrice ??
      it.pricing?.unitOriginalPrice ??
      product.basePrice ??
      product.pricingAndInventory?.originalPrice ??
      unitPrice
    );

    const quantity = Number(it.quantity ?? it.requestedQuantity ?? 1);
    const lineTotal = Number(it.lineTotal ?? it.pricing?.lineFinalTotal ?? (unitPrice * quantity));

    return {
      ...it,
      _id: it._id || productId,
      productId: product._id ? product : (it.productId || productId),
      product: product._id ? product : (it.product || product),
      productName: it.productName || product.name || 'Product',
      brand: it.brand || product.brand || '',
      image: it.image || product.image || product.imageUrl || (Array.isArray(product.images) && product.images[0]) || '',
      quantity,
      requestedQuantity: quantity,
      unitPrice,
      effectivePrice: unitPrice,
      currentPrice: unitPrice,
      originalPrice,
      lineTotal,
      itemTotal: lineTotal,
    };
  });

  const catalogSubtotal = Number(
    cartData.pricingSummary?.subtotal ??
    items.reduce((acc, it) => acc + (it.originalPrice * it.quantity), 0)
  );

  const finalTotal = Number(
    cartData.pricingSummary?.finalTotal ??
    items.reduce((acc, it) => acc + (it.effectivePrice * it.quantity), 0)
  );

  const discounts = Number(
    cartData.pricingSummary?.discounts ??
    Math.max(0, catalogSubtotal - finalTotal)
  );

  return {
    ...cartData,
    items,
    pricingSummary: {
      ...cartData.pricingSummary,
      subtotal: catalogSubtotal,
      discounts,
      finalTotal,
      itemCount: items.length,
      totalAvailableUnits: items.reduce((acc, it) => acc + it.quantity, 0),
    },
  };
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated, isCustomer } = useAuth();
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(GUEST_CART_KEY);
      return saved
        ? normalizeCartData(JSON.parse(saved))
        : { items: [], pricingSummary: { subtotal: 0, discounts: 0, finalTotal: 0 } };
    } catch {
      return { items: [], pricingSummary: { subtotal: 0, discounts: 0, finalTotal: 0 } };
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCart = useCallback(async () => {
    if (isAuthenticated && isCustomer) {
      try {
        setLoading(true);
        const data = await cartService.getCart();
        const normalized = normalizeCartData(data);
        setCart(normalized);
        try {
          localStorage.setItem(GUEST_CART_KEY, JSON.stringify(normalized));
        } catch {}
        setError(null);
      } catch (err) {
        setError(err?.message || 'Failed to fetch cart');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const saved = localStorage.getItem(GUEST_CART_KEY);
        if (saved) {
          setCart(normalizeCartData(JSON.parse(saved)));
        }
      } catch {}
    }
  }, [isAuthenticated, isCustomer]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productOrId, quantity = 1) => {
    const productId = typeof productOrId === 'string' ? productOrId : productOrId?._id;
    const product = typeof productOrId === 'object' ? productOrId : null;

    if (!productId) return;

    // Optimistically update local cart immediately for instant UI responsiveness
    setCart((prevCart) => {
      const prevItems = prevCart?.items || [];
      const existingIndex = prevItems.findIndex(
        (it) => (it.productId?._id || it.productId || it._id) === productId
      );

      const primaryBatch = product?.primaryBatch || product?.earliestBatch || {};
      const unitPrice =
        product?.effectivePrice ??
        primaryBatch.currentPrice ??
        product?.pricingAndInventory?.fefoPrice ??
        product?.pricingAndInventory?.lowestPrice ??
        product?.basePrice ??
        0;
      const originalPrice =
        product?.basePrice ??
        primaryBatch.originalPrice ??
        product?.pricingAndInventory?.originalPrice ??
        unitPrice;

      let updatedItems;
      if (existingIndex > -1) {
        updatedItems = prevItems.map((item, idx) => {
          if (idx === existingIndex) {
            const newQty = (item.quantity || 1) + quantity;
            const price = item.effectivePrice || unitPrice;
            return {
              ...item,
              quantity: newQty,
              requestedQuantity: newQty,
              itemTotal: newQty * price,
              lineTotal: newQty * price,
            };
          }
          return item;
        });
      } else {
        const newItem = {
          productId: product || { _id: productId, name: 'Product' },
          product: product || { _id: productId, name: 'Product' },
          productName: product?.name || 'Product',
          brand: product?.brand || '',
          image: product?.image || '',
          _id: productId,
          quantity,
          requestedQuantity: quantity,
          unitPrice,
          effectivePrice: unitPrice,
          currentPrice: unitPrice,
          originalPrice,
          lineTotal: unitPrice * quantity,
          itemTotal: unitPrice * quantity,
        };
        updatedItems = [...prevItems, newItem];
      }

      const newCart = normalizeCartData({
        ...prevCart,
        items: updatedItems,
      });

      try {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(newCart));
      } catch {}
      return newCart;
    });

    // If authenticated, sync with backend API in parallel
    if (isAuthenticated && isCustomer) {
      try {
        const data = await cartService.addItem(productId, quantity);
        const normalized = normalizeCartData(data);
        setCart(normalized);
        try {
          localStorage.setItem(GUEST_CART_KEY, JSON.stringify(normalized));
        } catch {}
        return normalized;
      } catch (err) {
        console.warn('Backend cart add error (preserved in local storage):', err);
      }
    }
  };

  const updateQuantity = async (productId, quantity) => {
    setCart((prevCart) => {
      const prevItems = prevCart?.items || [];
      const updatedItems = prevItems
        .map((it) => {
          const itId = it.productId?._id || it.productId || it._id;
          if (itId === productId) {
            if (quantity <= 0) return null;
            const price = it.effectivePrice || it.unitPrice || 0;
            return {
              ...it,
              quantity,
              requestedQuantity: quantity,
              itemTotal: quantity * price,
              lineTotal: quantity * price,
            };
          }
          return it;
        })
        .filter(Boolean);

      const newCart = normalizeCartData({
        ...prevCart,
        items: updatedItems,
      });

      try {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(newCart));
      } catch {}
      return newCart;
    });

    if (isAuthenticated && isCustomer) {
      try {
        const data = await cartService.updateItem(productId, quantity);
        const normalized = normalizeCartData(data);
        setCart(normalized);
        return normalized;
      } catch (err) {
        console.warn('Backend quantity update error:', err);
      }
    }
  };

  const removeFromCart = async (productId) => {
    setCart((prevCart) => {
      const prevItems = prevCart?.items || [];
      const updatedItems = prevItems.filter(
        (it) => (it.productId?._id || it.productId || it._id) !== productId
      );

      const newCart = normalizeCartData({
        ...prevCart,
        items: updatedItems,
      });

      try {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(newCart));
      } catch {}
      return newCart;
    });

    if (isAuthenticated && isCustomer) {
      try {
        const data = await cartService.removeItem(productId);
        const normalized = normalizeCartData(data);
        setCart(normalized);
        return normalized;
      } catch (err) {
        console.warn('Backend cart item remove error:', err);
      }
    }
  };

  const clearCart = async () => {
    const emptyCart = {
      items: [],
      pricingSummary: { subtotal: 0, discounts: 0, finalTotal: 0 },
    };
    setCart(emptyCart);
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(emptyCart));
    } catch {}

    if (isAuthenticated && isCustomer) {
      try {
        await cartService.clearCart();
      } catch (err) {
        console.warn('Backend cart clear error:', err);
      }
    }
  };

  const totalItemCount =
    cart?.items?.reduce((acc, item) => acc + (item.quantity || item.requestedQuantity || 1), 0) || 0;

  const value = {
    cart,
    loading,
    error,
    totalItemCount,
    fetchCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};

export default CartContext;
