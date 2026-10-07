import api from '../api/client';

export const orderService = {
  createOrder: async (payload) => {
    const res = await api.post('/orders', payload);
    return res.data;
  },

  getCustomerOrders: async (params = {}) => {
    const res = await api.get('/orders', { params });
    return res.data;
  },

  getSellerOrders: async (params = {}) => {
    const res = await api.get('/orders/seller', { params });
    return res.data;
  },

  getOrderById: async (id) => {
    const res = await api.get(`/orders/${id}`);
    return res.data;
  },

  updateOrderStatus: async (id, payload) => {
    const res = await api.patch(`/orders/${id}/status`, payload);
    return res.data;
  },

  cancelOrder: async (id, payload = {}) => {
    const res = await api.post(`/orders/${id}/cancel`, payload);
    return res.data;
  },

  trackOrder: async (id) => {
    const res = await api.get(`/orders/${id}/track`);
    return res.data;
  },

  getOrderTracking: async (id) => {
    const res = await api.get(`/orders/${id}/track`);
    return res.data;
  },

  getPickupQr: async (orderId) => {
    const res = await api.get(`/qr/pickup/${orderId}`);
    return res.data;
  },

  verifyPickupQr: async (token) => {
    const res = await api.post('/qr/pickup/verify', { token });
    return res.data;
  },
};

export default orderService;
