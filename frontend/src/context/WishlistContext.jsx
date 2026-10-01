import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cartService';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, isCustomer } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated || !isCustomer) {
      setWishlist([]);
      return;
    }
    try {
      setLoading(true);
      const data = await cartService.getWishlist();
      setWishlist(data?.items || (Array.isArray(data) ? data : []));
    } catch {
      setWishlist([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isCustomer]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const addToWishlist = async (productId) => {
    await cartService.addToWishlist(productId);
    await fetchWishlist();
  };

  const removeFromWishlist = async (productId) => {
    await cartService.removeFromWishlist(productId);
    await fetchWishlist();
  };

  const isInWishlist = (productId) => {
    return wishlist.some((item) => (item.productId?._id || item.productId) === productId);
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
