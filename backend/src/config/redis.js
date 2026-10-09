import Redis from 'ioredis';
import { env } from './env.js';

let redisClient = null;
let isConnected = false;
let isConnecting = false;

/**
 * Creates and initializes the singleton Redis client with safe reconnection policies.
 */
export const connectRedis = () => {
  if (redisClient) {
    return redisClient;
  }

  if (!env.REDIS_ENABLED) {
    if (env.isDevelopment) {
      console.log('ℹ️ [Redis] Caching is disabled (REDIS_ENABLED=false). Running in database-direct mode.');
    }
    return null;
  }

  if (isConnecting) {
    return redisClient;
  }

  isConnecting = true;

  try {
    const redisOptions = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1, // Fail fast so DB fallback engages without blocking requests
      connectTimeout: 5000,
      enableOfflineQueue: false, // Prevents queuing unbound commands when Redis is down
      retryStrategy: (times) => {
        if (times > 5) {
          console.warn('[Redis] Maximum reconnection attempts reached (5). Stopping automatic reconnect.');
          return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
      },
    };

    // If a full REDIS_URL was supplied (e.g. from cloud/docker) and host wasn't customized
    if (env.REDIS_URL && env.REDIS_URL !== 'redis://127.0.0.1:6379') {
      redisClient = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        enableOfflineQueue: false,
        retryStrategy: redisOptions.retryStrategy,
      });
    } else {
      redisClient = new Redis(redisOptions);
    }

    redisClient.on('connect', () => {
      isConnected = true;
      isConnecting = false;
      console.log(`🔌 [Redis] Connected successfully to host: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
    });

    redisClient.on('ready', () => {
      isConnected = true;
      isConnecting = false;
      console.log('✅ [Redis] Cache cluster ready to accept read/write commands.');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      isConnecting = false;
      // Never log full connection strings with passwords
      console.warn(`⚠️ [Redis] Connection warning (${err.code || err.message}). Fallback to MongoDB active.`);
    });

    redisClient.on('close', () => {
      isConnected = false;
      isConnecting = false;
    });

    // Attempt initial connect asynchronously without crashing process if Redis is offline
    redisClient.connect().catch((err) => {
      isConnected = false;
      isConnecting = false;
      console.warn(`⚠️ [Redis] Unable to establish connection (${err.code || err.message}). Safe fallback to MongoDB engaged.`);
    });

    return redisClient;
  } catch (err) {
    isConnected = false;
    isConnecting = false;
    console.error('[Redis] Failed to initialize Redis client:', err.message);
    return null;
  }
};

/**
 * Returns whether Redis is actively connected and ready for traffic.
 */
export const isRedisConnected = () => {
  return Boolean(isConnected && redisClient && redisClient.status === 'ready');
};

/**
 * Returns the current Redis client instance (or null if disabled/uninitialized).
 */
export const getRedisClient = () => {
  return redisClient;
};

/**
 * Allows test suites to inject an in-memory mock or custom client.
 */
export const setRedisClient = (mockClient) => {
  redisClient = mockClient;
  isConnected = Boolean(mockClient);
};

/**
 * Gracefully terminates the Redis connection during server shutdown.
 */
export const disconnectRedis = async () => {
  if (redisClient) {
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
        await redisClient.quit();
      } else {
        redisClient.disconnect();
      }
      console.log('[Redis] Connection closed gracefully.');
    } catch (err) {
      console.warn('[Redis] Non-critical error during disconnect:', err.message);
      redisClient.disconnect();
    } finally {
      redisClient = null;
      isConnected = false;
      isConnecting = false;
    }
  }
};

