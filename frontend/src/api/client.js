import axios from 'axios';

/**
 * Standardized ApiError unwrapping backend error responses.
 * Guarantees that errorCode, validation errors array, status and friendly message
 * are accessible across all UI components and React Hook Form handlers.
 */
export class ApiError extends Error {
  constructor(message, status, errorCode, errors = [], data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
    this.data = data;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor: Attach JWT Bearer Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Parse Standard ApiResponse & Unify Error Format
api.interceptors.response.use(
  (response) => {
    // Return the server's ApiResponse payload directly for ergonomic calling
    return response.data;
  },
  (error) => {
    const status = error.response?.status || 500;
    const responseData = error.response?.data;

    const message = responseData?.message || error.message || 'An unexpected error occurred';
    const errorCode = responseData?.errorCode || 'INTERNAL_ERROR';
    const validationErrors = responseData?.errors || [];

    // Trigger session expiry event on 401 Unauthorized
    // ONLY for protected API calls when an authenticated session actually expired.
    // NEVER trigger for /auth/login (bad credentials), /auth/register, or /auth/logout (already logging out).
    if (status === 401 && typeof window !== 'undefined') {
      const url = error.config?.url || '';
      const isAuthEndpoint =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/logout');

      if (!isAuthEndpoint) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    const apiError = new ApiError(message, status, errorCode, validationErrors, responseData);
    return Promise.reject(apiError);
  }
);

export default api;
