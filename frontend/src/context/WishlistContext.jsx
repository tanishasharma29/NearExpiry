import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cartService';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);
const GUEST_WISHLIST_KEY = 'nearexpiry_wishlist';

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, isCustomer } = useAuth();
  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem(GUEST_WISHLIST_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (isAuthenticated && isCustomer) {
      try {
        setLoading(true);
        const data = await cartService.getWishlist();
        const serverItems = data?.items || (Array.isArray(data) ? data : []);
        setWishlist(serverItems);
        try {
          localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(serverItems));
        } catch {}
      } catch (err) {
        // Fallback to local items if offline
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const saved = localStorage.getItem(GUEST_WISHLIST_KEY);
        setWishlist(saved ? JSON.parse(saved) : []);
      } catch {
        setWishlist([]);
      }
    }
  }, [isAuthenticated, isCustomer]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const addToWishlist = async (productOrId) => {
    const productId = typeof productOrId === 'string' ? productOrId : productOrId?._id;
    if (!productId) return;

    const itemObj =
      typeof productOrId === 'object'
        ? {
            productId: productOrId,
            _id: productId,
            addedAt: new Date().toISOString(),
          }
        : {
            productId: { _id: productId },
            _id: productId,
            addedAt: new Date().toISOString(),
          };

    setWishlist((prev) => {
      const exists = prev.some(
        (it) => (it.productId?._id || it.productId || it._id) === productId
      );
      if (exists) return prev;
      const updated = [itemObj, ...prev];
      try {
        localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(updated));
      } catch {}
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
    setWishlist((prev) => {
      const updated = prev.filter(
        (it) => (it.productId?._id || it.productId || it._id) !== productId
      );
      try {
        localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(updated));
      } catch {}
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
    return wishlist.some(
      (item) => (item.productId?._id || item.productId || item._id) === productId
    );
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
