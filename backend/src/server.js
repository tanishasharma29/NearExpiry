import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { initializeBackgroundJobs } from './jobs/index.js';
import { initSocket, closeSocket, socketNotificationBroker } from './config/socket.js';
import { defaultDispatcher } from './services/notification/notification.dispatcher.js';

const server = http.createServer(app);

const startServer = async () => {
  try {
    await connectDB();
    connectRedis();
    initSocket(server);
    defaultDispatcher.attachRealtimeBroker(socketNotificationBroker);
    initializeBackgroundJobs();

    server.listen(env.PORT, () => {
      console.log('==========================================================');
      console.log(`🚀 NearExpiry Backend running in [${env.NODE_ENV.toUpperCase()}] mode`);
      console.log(`🔗 Base URL    : http://localhost:${env.PORT}${env.API_PREFIX}`);
      console.log(`🩺 Health Check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
      console.log('==========================================================');
    });
  } catch (error) {
    console.error('[Server] Fatal startup failure:', error.message);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    await closeSocket();
    await disconnectDB();
    await disconnectRedis();
    console.log('[Server] HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  process.exit(1);
});

startServer();
