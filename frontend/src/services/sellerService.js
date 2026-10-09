import api from '../api/client';

export const sellerService = {
  getProfile: async () => {
    const res = await api.get('/sellers/profile');
    return res.data;
  },

  updateProfile: async (payload) => {
    const res = await api.patch('/sellers/profile', payload);
    return res.data;
  },

  getVerificationStatus: async () => {
    const res = await api.get('/sellers/verification-status');
    return res.data;
  },
};

export default sellerService;

