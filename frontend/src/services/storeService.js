import api from '../api/client';

export const storeService = {
  getStores: async (params = {}) => {
    const res = await api.get('/stores', { params });
    return res.data;
  },

  getStoreById: async (id) => {
    const res = await api.get(`/stores/${id}`);
    return res.data;
  },

  createStore: async (payload) => {
    const res = await api.post('/stores', payload);
    return res.data;
  },

  updateStore: async (id, payload) => {
    const res = await api.patch(`/stores/${id}`, payload);
    return res.data;
  },

  getNearbyStores: async (params = {}) => {
    const res = await api.get('/stores/nearby', { params });
    return res.data;
  },

  getStoreProducts: async (id, params = {}) => {
    const res = await api.get(`/stores/${id}/products`, { params });
    return res.data;
  },
};

export default storeService;
