import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Sync /me on initial mount if token exists & listen for unauthorized event
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await authService.getMe();
        const userData = data?.user || data;
        if (userData) {
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (err) {
        console.warn('Session expired or invalid, clearing local session', err?.message);
        // Clear local state without making any network requests
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    fetchMe();

    const handleUnauthorized = () => {
      // Clear expired local session without making outgoing network requests
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [token]);

  const login = async (email, password) => {
    const data = await authService.login({ email, password });
    const { token: receivedToken, user: receivedUser } = data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem('token', receivedToken);
    localStorage.setItem('user', JSON.stringify(receivedUser));
    return receivedUser;
  };

  const registerCustomer = async (formData) => {
    const data = await authService.registerCustomer(formData);
    const { token: receivedToken, user: receivedUser } = data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem('token', receivedToken);
    localStorage.setItem('user', JSON.stringify(receivedUser));
    return receivedUser;
  };

  const registerSeller = async (formData) => {
    const data = await authService.registerSeller(formData);
    const { token: receivedToken, user: receivedUser } = data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem('token', receivedToken);
    localStorage.setItem('user', JSON.stringify(receivedUser));
    return receivedUser;
  };

  const logout = () => {
    const currentToken = localStorage.getItem('token');
    // Clear local state first
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Fire and forget server logout only if token was present
    if (currentToken) {
      try {
        authService.logout().catch(() => {});
      } catch (_) {}
    }
  };

  const value = {
    user,
    token,
    role: user?.role || 'GUEST',
    isAuthenticated: !!token && !!user,
    isCustomer: user?.role === 'CUSTOMER',
    isSeller: user?.role === 'SELLER',
    isAdmin: user?.role === 'ADMIN',
    loading,
    login,
    registerCustomer,
    registerSeller,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
