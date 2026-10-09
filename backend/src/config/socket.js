import { Server } from 'socket.io';
import { env } from './env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { User, USER_ROLES } from '../models/user.model.js';
import { Store } from '../models/store.model.js';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../constants/socketEvents.js';

let ioInstance = null;

/**
 * Initializes the singleton Socket.IO server attached to the HTTP server.
 */
export const initSocket = (httpServer) => {
  if (ioInstance) {
    return ioInstance;
  }

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB limit for packet abuse prevention
  });

  // =========================================================================
  // Handshake Authentication Middleware
  // =========================================================================
  ioInstance.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      let token = socket.handshake.auth?.token;

      if (!token && authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      }

      if (!token) {
        return next(new Error('AUTHENTICATION_ERROR: Token is required for socket connection'));
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (jwtErr) {
        return next(new Error(`AUTHENTICATION_ERROR: ${jwtErr.message || 'Invalid or expired token'}`));
      }

      const user = await User.findById(decoded.sub);
      if (!user) {
        return next(new Error('AUTHENTICATION_ERROR: User belonging to token not found'));
      }

      if (!user.isActive) {
        return next(new Error('AUTHENTICATION_ERROR: User account deactivated'));
      }

      if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
        return next(new Error('AUTHENTICATION_ERROR: Token has been revoked due to logout'));
      }

      // Attach authoritative user to socket state
      socket.user = user;

      // If seller, pre-resolve active store during handshake
      if (user.role === USER_ROLES.SELLER) {
        try {
          const store = await Store.findOne({
            ownerId: user._id,
            verificationStatus: 'APPROVED',
            isActive: true,
          }).lean();

          if (store) {
            socket.storeId = store._id.toString();
          }
        } catch (storeErr) {
          console.warn(`[Socket.IO] Error pre-resolving store for seller ${user._id}:`, storeErr.message);
        }
      }

      next();
    } catch (err) {
      console.warn('[Socket.IO] Handshake authentication rejected:', err.message);
      next(new Error(`AUTHENTICATION_ERROR: ${err.message}`));
    }
  });

  // =========================================================================
  // Connection & Server-Managed Room Allocation
  // =========================================================================
  ioInstance.on('connection', (socket) => {
    const user = socket.user;

    // 1. Join private user room (isolated to this user)
    socket.join(SOCKET_ROOMS.user(user._id));

    // 2. If seller, join store room immediately
    if (socket.storeId) {
      socket.join(SOCKET_ROOMS.store(socket.storeId));
    }

    // 3. If admin, join the privileged admin alert room
    if (user.role === USER_ROLES.ADMIN) {
      socket.join(SOCKET_ROOMS.ADMIN);
    }

    // Reject arbitrary client-directed room joins
    socket.on('join_room', () => {
      socket.emit('error', { message: 'Unauthorized: Client cannot request arbitrary room joins' });
    });

    socket.on('disconnect', (reason) => {
      // Disconnection handled cleanly
    });
  });

  return ioInstance;
};

/**
 * Accesses the active Socket.IO server instance.
 */
export const getIO = () => {
  return ioInstance;
};

/**
 * Allows test suites to inject a mock or test instance.
 */
export const setIO = (mockIo) => {
  ioInstance = mockIo;
};

/**
 * Safely closes and cleans up the Socket.IO server.
 */
export const closeSocket = async () => {
  if (ioInstance) {
    await new Promise((resolve) => {
      ioInstance.close(() => {
        resolve();
      });
    });
    ioInstance = null;
  }
};

// =========================================================================
// Real-Time Emitters
// =========================================================================

/**
 * Emits an event to a specific user's private room.
 */
export const emitToUser = (userId, event, payload) => {
  try {
    if (!ioInstance) return false;
    ioInstance.to(SOCKET_ROOMS.user(userId)).emit(event, {
      ...payload,
      timestamp: payload?.timestamp || new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn(`[Socket.IO] Failed to emit to user ${userId}:`, err.message);
    return false;
  }
};

/**
 * Emits an event to a verified store room (all authorized seller sockets for that store).
 */
export const emitToStore = (storeId, event, payload) => {
  try {
    if (!ioInstance) return false;
    ioInstance.to(SOCKET_ROOMS.store(storeId)).emit(event, {
      ...payload,
      timestamp: payload?.timestamp || new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn(`[Socket.IO] Failed to emit to store ${storeId}:`, err.message);
    return false;
  }
};

/**
 * Emits an alert event to the administrative room.
 */
export const emitToAdmin = (event, payload) => {
  try {
    if (!ioInstance) return false;
    ioInstance.to(SOCKET_ROOMS.ADMIN).emit(event, {
      ...payload,
      timestamp: payload?.timestamp || new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('[Socket.IO] Failed to emit to admin room:', err.message);
    return false;
  }
};

/**
 * Notification dispatcher broker adapter.
 */
export const socketNotificationBroker = {
  emitToUser: (userId, notificationPayload) => {
    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, notificationPayload);
  },
};
