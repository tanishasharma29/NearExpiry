import api from '../api/client';

export const billingService = {
  getBillReceiptByOrderId: async (orderId) => {
    const res = await api.get(`/billing/order/${orderId}`);
    return res.data;
  },

  getSellerBillReceipts: async (params = {}) => {
    const res = await api.get('/billing/seller', { params });
    return res.data;
  },

  getCustomerBillReceipts: async (params = {}) => {
    const res = await api.get('/billing/customer', { params });
    return res.data;
  },
};

export default billingService;

