import api from '../api/client';

export const paymentService = {
  processPayment: async (payload) => {
    const res = await api.post('/payments/process', payload);
    return res.data;
  },

  getPaymentDetails: async (id) => {
    const res = await api.get(`/payments/${id}`);
    return res.data;
  },

  getPaymentByOrderId: async (orderId) => {
    const res = await api.get(`/payments/order/${orderId}`);
    return res.data;
  },

  confirmCodPayment: async (id) => {
    const res = await api.post(`/payments/${id}/confirm-cod`);
    return res.data;
  },

  refundPayment: async (id, payload = {}) => {
    const res = await api.post(`/payments/${id}/refund`, payload);
    return res.data;
  },
};

export default paymentService;
