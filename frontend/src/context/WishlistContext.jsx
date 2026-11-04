import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cartService';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);
const GUEST_WISHLIST_KEY = 'nearexpiry_wishlist';

const normalizeWishlistItem = (item) => {
  if (!item) return null;
  const productObj =
    (item.product && typeof item.product === 'object' ? item.product : null) ||
    (item.productId && typeof item.productId === 'object' ? item.productId : null) ||
    (typeof item === 'object' && item.name ? item : null);

  const prodId =
    productObj?._id ||
    (typeof item.productId === 'string' ? item.productId : null) ||
    (typeof item.product === 'string' ? item.product : null) ||
    item._id;

  return {
    ...item,
    _id: item._id || prodId,
    productId: productObj || prodId,
    product: productObj || prodId,
    targetDiscountPercentage: item.targetDiscountPercentage,
    livePricingSummary: item.livePricingSummary,
  };
};

export const WishlistProvider = ({ children }) => {
  const { user, isAuthenticated, isCustomer } = useAuth();
  const [wishlist, setWishlist] = useState(() => {
    try {
      if (isAuthenticated && !isCustomer) return [];
      const saved = localStorage.getItem(GUEST_WISHLIST_KEY);
      const list = saved ? JSON.parse(saved) : [];
      return Array.isArray(list) ? list.map(normalizeWishlistItem).filter(Boolean) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    // 1. Non-customer authenticated accounts (SELLER, ADMIN) do not have a customer wishlist
    if (isAuthenticated && !isCustomer) {
      setWishlist([]);
      return;
    }

    // 2. Authenticated Customer: fetch isolated server wishlist for this customer
    if (isAuthenticated && isCustomer) {
      try {
        setLoading(true);
        const data = await cartService.getWishlist();
        const rawList = Array.isArray(data?.wishlist)
          ? data.wishlist
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        const serverItems = rawList.map(normalizeWishlistItem).filter(Boolean);
        setWishlist(serverItems);
      } catch (err) {
        setWishlist([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // 3. Unauthenticated GUEST: load guest wishlist from localStorage
    try {
      const saved = localStorage.getItem(GUEST_WISHLIST_KEY);
      const list = saved ? JSON.parse(saved) : [];
      setWishlist(Array.isArray(list) ? list.map(normalizeWishlistItem).filter(Boolean) : []);
    } catch {
      setWishlist([]);
    }
  }, [user?._id, isAuthenticated, isCustomer]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const addToWishlist = async (productOrId) => {
    const productId = typeof productOrId === 'string' ? productOrId : productOrId?._id;
    if (!productId) return;
    const targetId = String(productId);

    const productObj = typeof productOrId === 'object' ? productOrId : { _id: productId };
    const itemObj = normalizeWishlistItem({
      _id: productId,
      productId: productObj,
      product: productObj,
      addedAt: new Date().toISOString(),
    });

    setWishlist((prev) => {
      const exists = prev.some((it) => {
        const pId =
          (it.productId && typeof it.productId === 'object' ? it.productId._id : it.productId) ||
          (it.product && typeof it.product === 'object' ? it.product._id : it.product) ||
          it._id;
        return String(pId) === targetId;
      });
      if (exists) return prev;
      const updated = [itemObj, ...prev];
      if (!isAuthenticated) {
        try {
          localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    if (isAuthenticated && isCustomer) {
      try {
        await cartService.addToWishlist(productId);
      } catch (err) {
        console.warn('Backend wishlist sync error:', err);
      }
    }
  };

  const removeFromWishlist = async (productId) => {
    if (!productId) return;
    const targetId = String(productId);

    setWishlist((prev) => {
      const updated = prev.filter((item) => {
        const pId =
          (item.productId && typeof item.productId === 'object' ? item.productId._id : item.productId) ||
          (item.product && typeof item.product === 'object' ? item.product._id : item.product) ||
          item._id;
        return String(pId) !== targetId;
      });
      if (!isAuthenticated) {
        try {
          localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    if (isAuthenticated && isCustomer) {
      try {
        await cartService.removeFromWishlist(productId);
      } catch (err) {
        console.warn('Backend wishlist remove error:', err);
      }
    }
  };

  const isInWishlist = (productId) => {
    if (!productId) return false;
    const targetId = String(productId);
    return wishlist.some((item) => {
      const pId =
        (item.productId && typeof item.productId === 'object' ? item.productId._id : item.productId) ||
        (item.product && typeof item.product === 'object' ? item.product._id : item.product) ||
        item._id;
      return String(pId) === targetId;
    });
  };

  const value = {
    wishlist,
    loading,
    fetchWishlist,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
};

export default WishlistContext;
