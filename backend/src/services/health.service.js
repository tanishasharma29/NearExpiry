import mongoose from 'mongoose';
import { env } from '../config/env.js';

export const getSystemHealthStatus = () => {
  const dbStates = {
    0: 'DISCONNECTED',
    1: 'CONNECTED',
    2: 'CONNECTING',
    3: 'DISCONNECTING',
  };

  return {
    success: true,
    message: 'NearExpiry API is running',
    status: 'UP',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      state: dbStates[mongoose.connection.readyState] || 'UNKNOWN',
      readyState: mongoose.connection.readyState,
    },
  };
};
