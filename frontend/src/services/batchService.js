import api from '../api/client';

export const batchService = {
  getBatches: async (params = {}) => {
    const res = await api.get('/batches', { params });
    return res.data;
  },

  getBatchById: async (id) => {
    const res = await api.get(`/batches/${id}`);
    return res.data;
  },

  createBatch: async (payload) => {
    const res = await api.post('/batches', payload);
    return res.data;
  },

  updateBatch: async (id, payload) => {
    const res = await api.patch(`/batches/${id}`, payload);
    return res.data;
  },

  deleteBatch: async (id) => {
    const res = await api.delete(`/batches/${id}`);
    return res.data;
  },

  getBatchHistory: async (id) => {
    const res = await api.get(`/batches/${id}/history`);
    return res.data;
  },

  getBatchQrCode: async (batchId) => {
    const res = await api.get(`/qr/batch/${batchId}`);
    return res.data;
  },

  verifyBatchQr: async (token) => {
    const res = await api.get('/qr/verify', { params: { token } });
    return res.data;
  },

  verifyBatchQrPayload: async (payload) => {
    const res = await api.post('/qr/verify', payload);
    return res.data;
  },

  revokeBatchQr: async (batchId, payload) => {
    const res = await api.post(`/qr/batch/${batchId}/revoke`, payload);
    return res.data;
  },

  getBatchQrAudit: async (batchId, params = {}) => {
    const res = await api.get(`/qr/batch/${batchId}/audit`, { params });
    return res.data;
  },
};

export default batchService;
