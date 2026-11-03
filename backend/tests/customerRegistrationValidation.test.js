import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { registerCustomerSchema } from '../src/validators/auth.validator.js';
import { globalErrorHandler } from '../src/middleware/error.middleware.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Customer Registration Validation & Error Handling Suite', () => {
  // Mock response generator for testing globalErrorHandler
  const createMockRes = () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    return res;
  };

  const createMockReq = () => ({
    method: 'POST',
    originalUrl: '/api/v1/auth/register/customer',
  });

  describe('1. Empty registration submission', () => {
    it('rejects an empty body with explicit field error requirements', async () => {
      const result = await registerCustomerSchema.safeParseAsync({ body: {} });
      assert.equal(result.success, false);

      const issues = result.error.errors;
      const fields = issues.map((i) => i.path[1]);
      assert.ok(fields.includes('name'));
      assert.ok(fields.includes('email'));
      assert.ok(fields.includes('password'));

      // Test error middleware handling of this ZodError
      const req = createMockReq();
      const res = createMockRes();
      globalErrorHandler(result.error, req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
      assert.notEqual(res.body.message, 'Request validation failed'); // Specific message, not generic!
      assert.ok(res.body.errors.length >= 3);
      // Ensure field names are clean without 'body.'
      const resFields = res.body.errors.map((e) => e.field);
      assert.ok(resFields.includes('name'));
      assert.ok(resFields.includes('email'));
      assert.ok(resFields.includes('password'));
    });
  });

  describe('2. Invalid email address', () => {
    it('rejects invalid email formats with "Please enter a valid email address"', async () => {
      const result = await registerCustomerSchema.safeParseAsync({
        body: {
          name: 'John Doe',
          email: 'not-an-email',
          password: 'securePassword123',
        },
      });
      assert.equal(result.success, false);
      const emailIssue = result.error.errors.find((i) => i.path.includes('email'));
      assert.ok(emailIssue);
      assert.equal(emailIssue.message, 'Please enter a valid email address');

      // Test error middleware response
      const req = createMockReq();
      const res = createMockRes();
      globalErrorHandler(result.error, req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.message, 'Please enter a valid email address');
      assert.deepEqual(res.body.errors, [
        { field: 'email', message: 'Please enter a valid email address' },
      ]);
    });
  });

  describe('3. Invalid phone number', () => {
    it('rejects short or non-digit phone numbers with specific validation message', async () => {
      const result = await registerCustomerSchema.safeParseAsync({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '12345',
          password: 'securePassword123',
        },
      });
      assert.equal(result.success, false);
      const phoneIssue = result.error.errors.find((i) => i.path.includes('phone'));
      assert.ok(phoneIssue);
      assert.equal(phoneIssue.message, 'Phone number must be between 10 and 15 digits');

      // Test error middleware response
      const req = createMockReq();
      const res = createMockRes();
      globalErrorHandler(result.error, req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.message, 'Phone number must be between 10 and 15 digits');
      assert.deepEqual(res.body.errors, [
        { field: 'phone', message: 'Phone number must be between 10 and 15 digits' },
      ]);
    });
  });

  describe('4. Weak or invalid password', () => {
    it('rejects passwords shorter than 8 characters', async () => {
      const result = await registerCustomerSchema.safeParseAsync({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '9876543210',
          password: 'short',
        },
      });
      assert.equal(result.success, false);
      const passIssue = result.error.errors.find((i) => i.path.includes('password'));
      assert.ok(passIssue);
      assert.equal(passIssue.message, 'Password must be at least 8 characters long');

      // Test error middleware response
      const req = createMockReq();
      const res = createMockRes();
      globalErrorHandler(result.error, req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.message, 'Password must be at least 8 characters long');
      assert.deepEqual(res.body.errors, [
        { field: 'password', message: 'Password must be at least 8 characters long' },
      ]);
    });
  });

  describe('5. Duplicate email registration conflict', () => {
    it('formats DUPLICATE_EMAIL error with clear actionable message', () => {
      const duplicateError = new ApiError(
        409,
        'An account with this email already exists. Please sign in or use another email.',
        'DUPLICATE_EMAIL',
        [
          {
            field: 'email',
            message: 'An account with this email already exists. Please sign in or use another email.',
          },
        ]
      );

      const req = createMockReq();
      const res = createMockRes();
      globalErrorHandler(duplicateError, req, res, () => {});

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'DUPLICATE_EMAIL');
      assert.equal(
        res.body.message,
        'An account with this email already exists. Please sign in or use another email.'
      );
      assert.deepEqual(res.body.errors, [
        {
          field: 'email',
          message: 'An account with this email already exists. Please sign in or use another email.',
        },
      ]);
    });

    it('formats MongoDB 11000 duplicate email error with clear actionable message', () => {
      const mongoError = {
        code: 11000,
        keyValue: { email: 'existing@example.com' },
      };

      const req = createMockReq();
      const res = createMockRes();
      globalErrorHandler(mongoError, req, res, () => {});

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'DUPLICATE_KEY_ERROR');
      assert.equal(
        res.body.message,
        'An account with this email already exists. Please sign in or use another email.'
      );
      assert.deepEqual(res.body.errors, [
        {
          field: 'email',
          message: 'An account with this email already exists. Please sign in or use another email.',
        },
      ]);
    });
  });

  describe('6. Valid registration details', () => {
    it('successfully parses valid customer registration payload and normalizes email', async () => {
      const validPayload = {
        name: 'Aarav Sharma',
        email: 'Aarav.Sharma@EXAMPLE.COM',
        phone: '9876543210',
        password: 'ValidPassword123!',
      };

      const result = await registerCustomerSchema.safeParseAsync({ body: validPayload });
      assert.equal(result.success, true);
      assert.equal(result.data.body.name, 'Aarav Sharma');
      assert.equal(result.data.body.email, 'aarav.sharma@example.com'); // Lowercased
      assert.equal(result.data.body.phone, '9876543210');
      assert.equal(result.data.body.password, 'ValidPassword123!');
    });
  });

  describe('7. Server 500 error sanitization', () => {
    it('returns structured 500 without leaking stack traces or sensitive details', () => {
      const internalError = new Error('Database connection pool timed out');

      const req = createMockReq();
      const res = createMockRes();
      globalErrorHandler(internalError, req, res, () => {});

      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'INTERNAL_SERVER_ERROR');
    });
  });
});

