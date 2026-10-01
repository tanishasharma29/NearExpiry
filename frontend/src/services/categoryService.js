import api from '../api/client';

export const categoryService = {
  getCategories: async (params = {}) => {
    const res = await api.get('/categories', { params });
    return res.data;
  },

  getCategoryById: async (id) => {
    const res = await api.get(`/categories/${id}`);
    return res.data;
  },

  createCategory: async (payload) => {
    const res = await api.post('/categories', payload);
    return res.data;
  },

  updateCategory: async (id, payload) => {
    const res = await api.patch(`/categories/${id}`, payload);
    return res.data;
  },

  deleteCategory: async (id) => {
    const res = await api.delete(`/categories/${id}`);
    return res.data;
  },
};

export default categoryService;
