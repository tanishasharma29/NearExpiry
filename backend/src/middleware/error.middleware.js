import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const globalErrorHandler = (err, req, res, next) => {
  let error = err;

  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    error = new ApiError(
      400,
      'Request validation failed',
      'VALIDATION_ERROR',
      formattedErrors,
      err.stack
    );
  } else if (error instanceof mongoose.Error.CastError) {
    error = new ApiError(
      400,
      `Invalid ${error.path}: ${error.value}`,
      'INVALID_OBJECT_ID',
      [],
      err.stack
    );
  } else if (error instanceof mongoose.Error.ValidationError) {
    const formattedErrors = Object.values(error.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    error = new ApiError(
      400,
      'Database validation failed',
      'DB_VALIDATION_ERROR',
      formattedErrors,
      err.stack
    );
  } else if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyValue || {})[0] || 'field';
    error = new ApiError(
      409,
      `Duplicate value entered for ${duplicateField}. Please use another value.`,
      'DUPLICATE_KEY_ERROR',
      [{ field: duplicateField, message: `${duplicateField} already exists` }],
      err.stack
    );
  } else if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, 'INTERNAL_SERVER_ERROR', [], err.stack);
  }

  if (error.statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl} ->`, err);
  }

  const clientMessage =
    env.isProduction && error.statusCode >= 500
      ? 'Internal Server Error'
      : error.message;

  return res.status(error.statusCode).json({
    success: false,
    message: clientMessage,
    errorCode: error.errorCode,
    ...(error.errors && error.errors.length > 0 && { errors: error.errors }),
    ...(env.isDevelopment && { stack: error.stack }),
  });
};

