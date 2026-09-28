export class ApiError extends Error {
  constructor(
    statusCode = 500,
    message = 'Internal Server Error',
    errorCode = 'INTERNAL_ERROR',
    errors = [],
    stack = ''
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
