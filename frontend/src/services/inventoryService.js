import api from '../api/client';

export const inventoryService = {
  getInventory: async (params = {}) => {
    const res = await api.get('/inventory', { params });
    return res.data;
  },

  getProductInventory: async (productId) => {
    const res = await api.get(`/inventory/${productId}`);
    return res.data;
  },

  getExpiryAlerts: async (params = {}) => {
    const res = await api.get('/expiry/alerts', { params });
    return res.data;
  },

  acknowledgeExpiryAlert: async (alertId) => {
    const res = await api.patch(`/expiry/alerts/${alertId}/acknowledge`);
    return res.data;
  },

  triggerExpirySweep: async (payload = {}) => {
    const res = await api.post('/expiry/run-job', payload);
    return res.data;
  },
};

export default inventoryService;
