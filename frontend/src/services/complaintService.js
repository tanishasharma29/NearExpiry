import api from '../api/client';

/**
 * Platform Dispute & Complaint Resolution Service
 * Handles both Customer Dispute lifecycle and Admin Resolution Console API requests.
 */
export const complaintService = {
  // ==========================================
  // CUSTOMER APIS
  // ==========================================

  /**
   * Submit a new customer complaint against an order
   * @param {Object} payload { orderId, category, subject, description, relatedItemId, evidenceUrls }
   */
  createComplaint: async (payload) => {
    const res = await api.post('/complaints', payload);
    return res.data;
  },

  /**
   * Retrieve list of complaints filed by the authenticated customer
   * @param {Object} params { page, limit, status }
   */
  getComplaints: async (params = {}) => {
    const res = await api.get('/complaints', { params });
    return res.data;
  },

  /**
   * Retrieve single customer complaint details and discussion thread
   * @param {string} complaintId
   */
  getComplaintById: async (complaintId) => {
    const res = await api.get(`/complaints/${complaintId}`);
    return res.data;
  },

  /**
   * Customer sends message / response in an ongoing complaint thread
   * @param {string} complaintId
   * @param {Object} payload { message, attachments }
   */
  sendComplaintMessage: async (complaintId, payload) => {
    const res = await api.post(`/complaints/${complaintId}/messages`, payload);
    return res.data;
  },

  /**
   * Customer closes complaint upon satisfactory resolution
   * @param {string} complaintId
   * @param {string} reason
   */
  closeComplaint: async (complaintId, reason = '') => {
    const res = await api.patch(`/complaints/${complaintId}/close`, { reason });
    return res.data;
  },

  // ==========================================
  // ADMIN RESOLUTION APIS
  // ==========================================

  /**
   * Admin lists platform complaints with filters
   * @param {Object} params { page, limit, status, priority, category, storeId, search, startDate, endDate }
   */
  getAdminComplaints: async (params = {}) => {
    const res = await api.get('/admin/complaints', { params });
    return res.data;
  },

  /**
   * Admin retrieves full complaint dossier with order, batch allocations, and timeline
   * @param {string} complaintId
   */
  getAdminComplaintDossier: async (complaintId) => {
    const res = await api.get(`/admin/complaints/${complaintId}`);
    return res.data;
  },

  /**
   * Admin transitions complaint status
   * @param {string} complaintId
   * @param {Object} payload { status, note }
   */
  updateComplaintStatus: async (complaintId, payload) => {
    const res = await api.patch(`/admin/complaints/${complaintId}/status`, payload);
    return res.data;
  },

  /**
   * Admin updates dispute priority
   * @param {string} complaintId
   * @param {Object} payload { priority, note }
   */
  updateComplaintPriority: async (complaintId, payload) => {
    const res = await api.patch(`/admin/complaints/${complaintId}/priority`, payload);
    return res.data;
  },

  /**
   * Admin assigns dispute to moderator
   * @param {string} complaintId
   * @param {Object} payload { adminId }
   */
  assignComplaint: async (complaintId, payload) => {
    const res = await api.patch(`/admin/complaints/${complaintId}/assign`, payload);
    return res.data;
  },

  /**
   * Admin sends customer-visible response
   * @param {string} complaintId
   * @param {Object} payload { message, attachments, isInternalNote }
   */
  sendAdminMessage: async (complaintId, payload) => {
    const res = await api.post(`/admin/complaints/${complaintId}/messages`, payload);
    return res.data;
  },

  /**
   * Admin records internal team note (hidden from customer)
   * @param {string} complaintId
   * @param {Object} payload { note }
   */
  addAdminInternalNote: async (complaintId, payload) => {
    const res = await api.post(`/admin/complaints/${complaintId}/notes`, payload);
    return res.data;
  },

  /**
   * Admin executes resolution decision with optional safe operational actions
   * @param {string} complaintId
   * @param {Object} payload { decision, notes, refundAmount, actionRequested }
   */
  resolveComplaint: async (complaintId, payload) => {
    const res = await api.post(`/admin/complaints/${complaintId}/resolve`, payload);
    return res.data;
  },
};

export default complaintService;

