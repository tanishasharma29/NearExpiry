import api from '../api/client';

export const analyticsService = {
  getSellerAnalytics: async (period = '30d') => {
    const res = await api.get('/analytics/seller', { params: { period } });
    return res.data;
  },

  getAdminAnalytics: async (period = '30d') => {
    const res = await api.get('/analytics/admin', { params: { period } });
    return res.data;
  },
};

export default analyticsService;
