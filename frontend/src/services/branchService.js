import api from '../api/client';

export const branchService = {
  /**
   * Seller retrieves all branches for their store
   */
  getMyBranches: async () => {
    const res = await api.get('/branches/my-branches');
    return res.data;
  },

  /**
   * Public/Customer discovery of active branches for a store
   */
  getStoreBranches: async (storeId, params = {}) => {
    const res = await api.get(`/branches/store/${storeId}`, { params });
    return res.data;
  },

  /**
   * Public/Customer discovery of all active branches across approved stores
   */
  getActiveBranches: async () => {
    const res = await api.get('/branches/active');
    return Array.isArray(res) ? res : res?.data !== undefined ? res.data : res;
  },

  /**
   * Seller creates a new branch
   */
  createBranch: async (payload) => {
    const res = await api.post('/branches', payload);
    return res.data;
  },

  /**
   * Seller or Admin updates branch details
   */
  updateBranch: async (id, payload) => {
    const res = await api.put(`/branches/${id}`, payload);
    return res.data;
  },

  /**
   * Seller or Admin toggles branch active / inactive status
   */
  toggleBranchStatus: async (id, isActive) => {
    const res = await api.patch(`/branches/${id}/status`, { isActive });
    return res.data;
  },

  /**
   * Seller designates branch as the primary branch
   */
  setPrimaryBranch: async (id) => {
    const res = await api.patch(`/branches/${id}/primary`);
    return res.data;
  },

  /**
   * Seller or Admin inspects inventory lots dedicated to this branch
   */
  getBranchInventory: async (id) => {
    const res = await api.get(`/branches/${id}/inventory`);
    return res.data;
  },
};

export default branchService;

