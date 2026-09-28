import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(
      `[MongoDB] Connected successfully -> Host: ${conn.connection.host} | DB: ${conn.connection.name}`
    );

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Runtime connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Connection lost. Attempting to reconnect...');
    });

    return conn;
  } catch (error) {
    console.error(`[MongoDB] Initial connection warning: ${error.message}`);
    console.warn('[MongoDB] Server starting while waiting for MongoDB on 27017...');
    return null;
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('[MongoDB] Connection closed gracefully.');
  }
};
