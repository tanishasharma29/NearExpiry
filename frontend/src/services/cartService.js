import api from '../api/client';

export const cartService = {
  getCart: async () => {
    const res = await api.get('/cart');
    return res.data;
  },

  addItem: async (productId, quantity = 1) => {
    const res = await api.post('/cart/items', { productId, quantity });
    return res.data;
  },

  updateItem: async (productId, quantity) => {
    const res = await api.put(`/cart/items/${productId}`, { quantity });
    return res.data;
  },

  removeItem: async (productId) => {
    const res = await api.delete(`/cart/items/${productId}`);
    return res.data;
  },

  clearCart: async () => {
    const res = await api.delete('/cart');
    return res.data;
  },

  validateCheckout: async (payload = {}) => {
    const res = await api.post('/cart/checkout-validate', payload);
    return res.data;
  },

  syncCart: async () => {
    const res = await api.post('/cart/sync');
    return res.data;
  },

  reserveStock: async () => {
    const res = await api.post('/cart/reserve');
    return res.data;
  },

  getWishlist: async () => {
    const res = await api.get('/wishlist');
    return res.data;
  },

  addToWishlist: async (productId) => {
    const res = await api.post('/wishlist', { productId });
    return res.data;
  },

  removeFromWishlist: async (productId) => {
    const res = await api.delete(`/wishlist/${productId}`);
    return res.data;
  },
};

export default cartService;
