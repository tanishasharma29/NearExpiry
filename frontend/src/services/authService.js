import api from '../api/client';

export const authService = {
  registerCustomer: async (payload) => {
    const res = await api.post('/auth/register/customer', payload);
    return res.data;
  },

  registerSeller: async (payload) => {
    const res = await api.post('/auth/register/seller', payload);
    return res.data;
  },

  registerAdmin: async (payload) => {
    const res = await api.post('/auth/register/admin', payload);
    return res.data;
  },

  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
};

export default authService;
