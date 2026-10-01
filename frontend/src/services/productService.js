import api from '../api/client';

export const productService = {
  getMyProducts: async (params = {}) => {
    const res = await api.get('/products/my-products', { params });
    return res.data;
  },

  getProducts: async (params = {}) => {
    const res = await api.get('/products', { params });
    return res.data;
  },

  getProductById: async (id) => {
    const res = await api.get(`/products/${id}`);
    return res.data;
  },

  createProduct: async (payload) => {
    const res = await api.post('/products', payload);
    return res.data;
  },

  updateProduct: async (id, payload) => {
    const res = await api.patch(`/products/${id}`, payload);
    return res.data;
  },

  deleteProduct: async (id) => {
    const res = await api.delete(`/products/${id}`);
    return res.data;
  },

  getProductBatches: async (id) => {
    const res = await api.get(`/products/${id}/batches`);
    return res.data;
  },

  getMarketplaceProducts: async (params = {}) => {
    const res = await api.get('/marketplace/products', { params });
    return res.data;
  },

  getMarketplaceProductById: async (id, params = {}) => {
    const res = await api.get(`/marketplace/products/${id}`, { params });
    return res.data;
  },

  getMarketplaceProductBatches: async (id) => {
    const res = await api.get(`/marketplace/products/${id}/batches`);
    return res.data;
  },

  getMarketplaceNearby: async (params = {}) => {
    const res = await api.get('/marketplace/nearby', { params });
    return res.data;
  },

  getMarketplaceNearbyStores: async (params = {}) => {
    const res = await api.get('/marketplace/nearby-stores', { params });
    return res.data;
  },

  getMarketplaceStats: async () => {
    const res = await api.get('/marketplace/stats');
    return res.data;
  },
};

export default productService;
