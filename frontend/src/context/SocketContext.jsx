import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState([]);
  const socketRef = useRef(null);

  // Compute Socket.IO server URL
  const getSocketUrl = () => {
    if (import.meta.env.VITE_SOCKET_URL) {
      return import.meta.env.VITE_SOCKET_URL;
    }
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && apiUrl.startsWith('http')) {
      try {
        const parsed = new URL(apiUrl);
        return parsed.origin;
      } catch {
        return 'http://localhost:5000';
      }
    }
    // Default to current host or dev proxy
    return window.location.origin;
  };

  useEffect(() => {
    // If user is not authenticated, ensure socket is disconnected
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // The server forcefully disconnected (e.g. token expired/revoked)
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
    });

    // Central live notification listener
    const handleLiveEvent = (eventType, payload) => {
      const alertId = `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newAlert = {
        id: alertId,
        type: eventType,
        ...payload,
        receivedAt: new Date(),
      };

      setLiveNotifications((prev) => [newAlert, ...prev.slice(0, 9)]);

      // Custom window event for decoupled UI listeners
      window.dispatchEvent(
        new CustomEvent('nearexpiry:realtime', {
          detail: newAlert,
        })
      );
    };

    socket.on('seller:order:new', (data) => handleLiveEvent('seller:order:new', data));
    socket.on('customer:order:status', (data) => handleLiveEvent('customer:order:status', data));
    socket.on('inventory:changed', (data) => handleLiveEvent('inventory:changed', data));
    socket.on('admin:alert', (data) => handleLiveEvent('admin:alert', data));
    socket.on('notification:new', (data) => handleLiveEvent('notification:new', data));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('seller:order:new');
      socket.off('customer:order:status');
      socket.off('inventory:changed');
      socket.off('admin:alert');
      socket.off('notification:new');
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token]);

  const dismissAlert = useCallback((id) => {
    setLiveNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setLiveNotifications([]);
  }, []);

  const subscribe = useCallback((event, callback) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on(event, callback);
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        liveNotifications,
        dismissAlert,
        clearAlerts,
        subscribe,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;

