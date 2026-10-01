import api from '../api/client';

export const adminService = {
  getDashboard: async () => {
    const res = await api.get('/admin/dashboard');
    return res.data;
  },

  getSellers: async (params = {}) => {
    const res = await api.get('/admin/sellers', { params });
    return res.data;
  },

  updateSellerApproval: async (sellerId, payload) => {
    const res = await api.patch(`/admin/sellers/${sellerId}/approval`, payload);
    return res.data;
  },

  getUsers: async (params = {}) => {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  getUserById: async (id) => {
    const res = await api.get(`/admin/users/${id}`);
    return res.data;
  },

  updateUserStatus: async (id, payload) => {
    const res = await api.patch(`/admin/users/${id}/status`, payload);
    return res.data;
  },

  getStores: async (params = {}) => {
    const res = await api.get('/admin/stores', { params });
    return res.data;
  },

  getStoreById: async (id) => {
    const res = await api.get(`/admin/stores/${id}`);
    return res.data;
  },

  updateStoreStatus: async (id, payload) => {
    const res = await api.patch(`/admin/stores/${id}/status`, payload);
    return res.data;
  },

  getProducts: async (params = {}) => {
    const res = await api.get('/admin/products', { params });
    return res.data;
  },

  moderateProduct: async (id, payload) => {
    const res = await api.patch(`/admin/products/${id}/moderation`, payload);
    return res.data;
  },

  getCategories: async () => {
    const res = await api.get('/admin/categories');
    return res.data;
  },

  getPricingRules: async () => {
    const res = await api.get('/admin/pricing-rules');
    return res.data;
  },

  resetPricingRules: async () => {
    const res = await api.post('/admin/pricing-rules/reset-defaults');
    return res.data;
  },

  triggerPricingSweep: async () => {
    const res = await api.post('/admin/pricing-rules/trigger-sweep');
    return res.data;
  },

  getInventoryMonitoring: async (params = {}) => {
    const res = await api.get('/admin/inventory', { params });
    return res.data;
  },

  getExpiryMonitoring: async () => {
    const res = await api.get('/admin/expiry');
    return res.data;
  },

  getOrders: async (params = {}) => {
    const res = await api.get('/admin/orders', { params });
    return res.data;
  },

  getOrderDetails: async (id) => {
    const res = await api.get(`/admin/orders/${id}`);
    return res.data;
  },

  getReports: async (params = {}) => {
    const res = await api.get('/admin/reports', { params });
    return res.data;
  },

  getAuditLogs: async (params = {}) => {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data;
  },
};

export default adminService;
