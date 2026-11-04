import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { apiRateLimiter } from './middleware/rateLimiter.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { globalErrorHandler } from './middleware/error.middleware.js';
import apiRoutes from './routes/index.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors(corsOptions));

app.use(morgan(env.isDevelopment ? 'dev' : 'combined'));

app.use(env.API_PREFIX, apiRateLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(env.API_PREFIX, apiRoutes);

// Root landing route for health probe and browser checks
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NearExpiry API Server is live and running!',
    healthCheck: `${env.API_PREFIX}/health`,
    version: '1.0.0',
  });
});

app.use(notFoundHandler);

app.use(globalErrorHandler);

export default app;
