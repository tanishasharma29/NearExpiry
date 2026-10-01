import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../../src/app.js';
import { connectTestDB, clearTestDB, disconnectTestDB } from '../setup/testDb.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../../../src/models/user.model.js';
import { Store } from '../../../src/models/store.model.js';

describe('Integration Tests: Authentication, JWT, Role Authorization & Admin Permissions', () => {
  const ts = Date.now();
  let customerToken = '';
  let sellerToken = '';
  let adminToken = '';
  let pendingSellerId = '';

  beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();
  });

  afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
  });

  // --------------------------------------------------------------------------
  // 1. REGISTRATION
  // --------------------------------------------------------------------------
  describe('1. User Registration Flow', () => {
    it('Given valid customer registration details, When POST /api/v1/auth/register/customer, Then creates customer account and returns JWT token', async () => {
      // Given
      const customerData = {
        name: 'Arjun Verma',
        email: `arjun.${ts}@customer.com`,
        phone: '9876501111',
        password: 'Password@123',
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/register/customer')
        .send(customerData);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe(USER_ROLES.CUSTOMER);
      expect(res.body.data.user.email).toBe(customerData.email.toLowerCase());
      customerToken = res.body.data.token;
    });

    it('Given valid seller registration details, When POST /api/v1/auth/register/seller, Then creates seller account, provisions store and returns PENDING status', async () => {
      // Given
      const sellerData = {
        name: 'Suresh Patel',
        email: `suresh.${ts}@store.com`,
        phone: '9876502222',
        password: 'Password@123',
        storeName: `Patel Supermart ${ts}`,
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/register/seller')
        .send(sellerData);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe(USER_ROLES.SELLER);
      expect(res.body.data.user.verificationStatus).toBe(VERIFICATION_STATUS.PENDING);
      sellerToken = res.body.data.token;
      pendingSellerId = res.body.data.user._id;

      // Verify Store was automatically provisioned in MongoDB
      const store = await Store.findOne({ ownerId: pendingSellerId });
      expect(store).not.toBeNull();
      expect(store.storeName).toBe(sellerData.storeName);
    });

    it('Given valid admin registration details, When POST /api/v1/auth/register/admin, Then creates admin account and returns APPROVED status', async () => {
      // Given
      const adminData = {
        name: 'Chief Admin',
        email: `admin.${ts}@nearexpiry.com`,
        phone: '9876503333',
        password: 'Password@123',
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/register/admin')
        .send(adminData);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(USER_ROLES.ADMIN);
      adminToken = res.body.data.token;
    });

    it('Given duplicate email on registration, When POST /api/v1/auth/register/customer, Then rejects with 409 Conflict', async () => {
      // Given (Email registered in previous test)
      const duplicateData = {
        name: 'Arjun Clone',
        email: `arjun.${ts}@customer.com`,
        phone: '9876509999',
        password: 'Password@123',
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/register/customer')
        .send(duplicateData);

      // Then
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('DUPLICATE_EMAIL');
    });

    it('Given invalid schema (short password or bad email), When POST /api/v1/auth/register/customer, Then rejects with 400 Validation Error', async () => {
      // Given
      const badData = {
        name: 'A',
        email: 'invalid-email',
        password: '123',
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/register/customer')
        .send(badData);

      // Then
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  // --------------------------------------------------------------------------
  // 2. LOGIN
  // --------------------------------------------------------------------------
  describe('2. User Login Flow', () => {
    it('Given valid credentials, When POST /api/v1/auth/login, Then returns 200 OK with fresh JWT token and user profile', async () => {
      // Given
      const credentials = {
        email: `arjun.${ts}@customer.com`,
        password: 'Password@123',
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(credentials.email.toLowerCase());
    });

    it('Given incorrect password, When POST /api/v1/auth/login, Then rejects with 401 Unauthorized', async () => {
      // Given
      const badCredentials = {
        email: `arjun.${ts}@customer.com`,
        password: 'WrongPassword456',
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(badCredentials);

      // Then
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('Given non-existent email, When POST /api/v1/auth/login, Then rejects with 401 Unauthorized', async () => {
      // Given
      const unknownEmail = {
        email: 'ghost.user.404@nowhere.com',
        password: 'Password@123',
      };

      // When
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(unknownEmail);

      // Then
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
    });
  });

  // --------------------------------------------------------------------------
  // 3. JWT HANDLING & SESSION VERIFICATION
  // --------------------------------------------------------------------------
  describe('3. JWT Handling & Session Verification (/auth/me)', () => {
    it('Given a valid Bearer token, When GET /api/v1/auth/me, Then returns authenticated user profile', async () => {
      // Given
      const token = customerToken;

      // When
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(USER_ROLES.CUSTOMER);
    });

    it('Given an invalid or tampered Bearer token, When GET /api/v1/auth/me, Then rejects with 401 Unauthorized', async () => {
      // Given
      const tamperedToken = 'invalid.jwt.signature_here';

      // When
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      // Then
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Given missing Authorization header, When GET /api/v1/auth/me, Then rejects with 401 Unauthorized', async () => {
      // When
      const res = await request(app).get('/api/v1/auth/me');

      // Then
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. ROLE AUTHORIZATION BOUNDARIES
  // --------------------------------------------------------------------------
  describe('4. Role-Based Route Authorization Boundaries', () => {
    it('Given CUSTOMER role token, When attempting to access SELLER portal route (/api/v1/stores/my-store), Then rejects with 403 Forbidden', async () => {
      // Given
      const token = customerToken;

      // When
      const res = await request(app)
        .get('/api/v1/stores/my-store')
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_ROLE');
    });

    it('Given SELLER role token, When attempting to access ADMIN command route (/api/v1/admin/dashboard), Then rejects with 403 Forbidden', async () => {
      // Given
      const token = sellerToken;

      // When
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      // Then
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_ROLE');
    });
  });

  // --------------------------------------------------------------------------
  // 5. SELLER APPROVAL WORKFLOW
  // --------------------------------------------------------------------------
  describe('5. Seller Review & Approval Workflow', () => {
    it('Given an unapproved seller, When ADMIN approves seller via PATCH /api/v1/admin/sellers/:id/approval, Then sets status to APPROVED and activates store', async () => {
      // Given
      const payload = { status: 'APPROVED' };

      // When
      const res = await request(app)
        .patch(`/api/v1/admin/sellers/${pendingSellerId}/approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.seller.verificationStatus).toBe(VERIFICATION_STATUS.APPROVED);
      expect(res.body.data.store.verificationStatus).toBe(VERIFICATION_STATUS.APPROVED);
      expect(res.body.data.store.isActive).toBe(true);
    });

    it('Given a non-admin user (CUSTOMER), When attempting to review seller approval, Then rejects with 403 Forbidden', async () => {
      // Given
      const payload = { status: 'APPROVED' };

      // When
      const res = await request(app)
        .patch(`/api/v1/admin/sellers/${pendingSellerId}/approval`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 20. ADMIN PERMISSIONS & USER DIRECTORY
  // --------------------------------------------------------------------------
  describe('20. Admin Permissions & Platform Oversight', () => {
    it('Given ADMIN credentials, When GET /api/v1/admin/dashboard, Then returns consolidated platform KPIs', async () => {
      // When
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalCustomers).toBeDefined();
      expect(res.body.data.totalSellers).toBeDefined();
      expect(res.body.data.products).toBeDefined();
    });

    it('Given ADMIN credentials, When listing users via GET /api/v1/admin/users, Then returns registered users list', async () => {
      // When
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(3);
    });
  });
});
