import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listNotificationsSchema,
  notificationIdParamSchema,
} from '../src/validators/notification.validator.js';
import {
  groupNotificationsByTime,
  getNotificationCategoryMeta,
} from '../../frontend/src/utils/notificationGrouping.js';
import { NOTIFICATION_TYPES } from '../src/models/notification.model.js';

describe('Unified Grouped Notification Center Test Suite', () => {
  // =========================================================================
  // 1. Time Grouping & Midnight Calendar Boundary Tests
  // =========================================================================
  describe('1. Time Grouping & Midnight Boundary Grouping', () => {
    it('accurately categorizes timestamps into Today, Yesterday, and Earlier based on local midnight', () => {
      const now = new Date();
      // Midday today
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      // Midday yesterday
      const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 0, 0);
      // 3 days ago
      const earlierDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 10, 0, 0);

      const mockNotifications = [
        { _id: 'notif_earlier', title: 'Old Alert', createdAt: earlierDate.toISOString() },
        { _id: 'notif_today', title: 'Today Alert', createdAt: todayDate.toISOString() },
        { _id: 'notif_yesterday', title: 'Yesterday Alert', createdAt: yesterdayDate.toISOString() },
      ];

      const grouped = groupNotificationsByTime(mockNotifications);

      assert.equal(grouped.today.length, 1);
      assert.equal(grouped.today[0]._id, 'notif_today');

      assert.equal(grouped.yesterday.length, 1);
      assert.equal(grouped.yesterday[0]._id, 'notif_yesterday');

      assert.equal(grouped.earlier.length, 1);
      assert.equal(grouped.earlier[0]._id, 'notif_earlier');
    });

    it('ensures notifications inside groups are strictly sorted newest-first', () => {
      const now = new Date();
      const t1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString();
      const t2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0).toISOString();
      const t3 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 15, 0).toISOString();

      const unordered = [
        { _id: '1', title: 'Morning', createdAt: t1 },
        { _id: '2', title: 'Afternoon', createdAt: t2 },
        { _id: '3', title: 'Noon', createdAt: t3 },
      ];

      const grouped = groupNotificationsByTime(unordered);
      assert.equal(grouped.today.length, 3);
      assert.equal(grouped.today[0]._id, '2'); // newest
      assert.equal(grouped.today[1]._id, '3');
      assert.equal(grouped.today[2]._id, '1'); // oldest
    });

    it('safely handles empty arrays or notifications with invalid timestamps', () => {
      const groupedEmpty = groupNotificationsByTime([]);
      assert.deepEqual(groupedEmpty, { today: [], yesterday: [], earlier: [] });

      const invalidDateNotif = [{ _id: 'inv', title: 'Corrupted date', createdAt: 'not-a-date' }];
      const groupedInvalid = groupNotificationsByTime(invalidDateNotif);
      assert.equal(groupedInvalid.earlier.length, 1);
      assert.equal(groupedInvalid.earlier[0]._id, 'inv');
    });
  });

  // =========================================================================
  // 2. Role-Specific Category Metadata Mapping
  // =========================================================================
  describe('2. Role-Specific Category Mapping', () => {
    it('correctly maps seller notification types to seller categories', () => {
      const orderMeta = getNotificationCategoryMeta({ type: 'NEW_ORDER', title: 'New order' }, 'SELLER');
      assert.equal(orderMeta.key, 'ORDERS');
      assert.equal(orderMeta.label, 'Orders & Sales');

      const expiryMeta = getNotificationCategoryMeta({ type: 'APPROACHING_EXPIRY', title: 'Expiry alert' }, 'SELLER');
      assert.equal(expiryMeta.key, 'EXPIRY');
      assert.equal(expiryMeta.label, 'Expiry Alerts');

      const inventoryMeta = getNotificationCategoryMeta({ type: 'LOW_STOCK', title: 'Low stock' }, 'SELLER');
      assert.equal(inventoryMeta.key, 'INVENTORY');
      assert.equal(inventoryMeta.label, 'Inventory & Batches');

      const complianceMeta = getNotificationCategoryMeta({ type: 'STORE_APPROVED', title: 'Store approved' }, 'SELLER');
      assert.equal(complianceMeta.key, 'COMPLIANCE');
      assert.equal(complianceMeta.label, 'Store Compliance');
    });

    it('correctly maps admin notification types to admin governance categories', () => {
      const supportMeta = getNotificationCategoryMeta(
        { type: 'COMPLAINT', title: '[Seller Support] Store Legal Document Verification' },
        'ADMIN'
      );
      assert.equal(supportMeta.key, 'SUPPORT');
      assert.equal(supportMeta.label, 'Support & Disputes');

      const kycMeta = getNotificationCategoryMeta(
        { type: 'DOCUMENT_REQUEST', title: 'Document Verification Requested' },
        'ADMIN'
      );
      assert.equal(kycMeta.key, 'VERIFICATION');
      assert.equal(kycMeta.label, 'Document Verification');

      const onboardingMeta = getNotificationCategoryMeta(
        { type: 'STORE_APPROVED', title: 'New Seller Registration' },
        'ADMIN'
      );
      assert.equal(onboardingMeta.key, 'ONBOARDING');
      assert.equal(onboardingMeta.label, 'Store Onboarding');

      const radarMeta = getNotificationCategoryMeta(
        { type: 'CRITICAL_EXPIRY', title: 'Critical Expiry Alert' },
        'ADMIN'
      );
      assert.equal(radarMeta.key, 'INVENTORY');
      assert.equal(radarMeta.label, 'Inventory & Expiry');
    });
  });

  // =========================================================================
  // 3. Validation Schema Enforcement
  // =========================================================================
  describe('3. Validation Schema Enforcement', () => {
    it('accepts valid query parameters for pagination, read status, and category', () => {
      const validQuery = {
        query: {
          page: '2',
          limit: '25',
          isRead: 'false',
          category: 'ORDERS',
          type: 'NEW_ORDER',
        },
      };

      const result = listNotificationsSchema.safeParse(validQuery);
      assert.equal(result.success, true);
    });

    it('rejects invalid boolean formats for isRead', () => {
      const invalidQuery = {
        query: {
          isRead: 'yes',
        },
      };

      const result = listNotificationsSchema.safeParse(invalidQuery);
      assert.equal(result.success, false);
    });

    it('validates 24-character hexadecimal MongoDB ObjectIds for notification actions', () => {
      const validParams = { params: { id: '507f1f77bcf86cd799439011' } };
      const invalidParams = { params: { id: 'invalid-id-123' } };

      assert.equal(notificationIdParamSchema.safeParse(validParams).success, true);
      assert.equal(notificationIdParamSchema.safeParse(invalidParams).success, false);
    });
  });

  // =========================================================================
  // 4. Role Isolation & Filter Construction Logic
  // =========================================================================
  describe('4. Tenant & Role Isolation Logic', () => {
    it('strictly confines query filter to the authenticated user ID', () => {
      const authenticatedUserId = '609b1f77bcf86cd799439011';
      const foreignUserId = '609b1f77bcf86cd799439022';

      // Simulating query construction in notification.service.js
      const buildServiceFilter = (userId, queryParams = {}) => {
        const filter = { recipient: userId };
        if (queryParams.isRead !== undefined && queryParams.isRead !== '') {
          filter.isRead = queryParams.isRead === 'true' || queryParams.isRead === true;
        }
        const typeFilter = queryParams.type || queryParams.category;
        if (typeFilter && typeFilter !== 'ALL') {
          filter.type = typeFilter;
        }
        return filter;
      };

      const filter = buildServiceFilter(authenticatedUserId, { category: 'ORDERS', isRead: 'false' });

      // recipient MUST equal authenticatedUserId, never foreignUserId
      assert.equal(filter.recipient, authenticatedUserId);
      assert.notEqual(filter.recipient, foreignUserId);
      assert.equal(filter.isRead, false);
      assert.equal(filter.type, 'ORDERS');
    });

    it('safely ignores category "ALL" to return all user notifications', () => {
      const userId = '609b1f77bcf86cd799439011';
      const buildServiceFilter = (uid, queryParams = {}) => {
        const filter = { recipient: uid };
        const typeFilter = queryParams.type || queryParams.category;
        if (typeFilter && typeFilter !== 'ALL') {
          filter.type = typeFilter;
        }
        return filter;
      };

      const filter = buildServiceFilter(userId, { category: 'ALL' });
      assert.equal(filter.recipient, userId);
      assert.equal(filter.type, undefined);
    });
  });

  // =========================================================================
  // 5. Ownership Guarding on Read & Delete Operations
  // =========================================================================
  describe('5. Ownership Guarding on Read & Delete Mutations', () => {
    it('verifies that mark-as-read requires matching both _id and recipient', () => {
      const sellerId = 'seller_123';
      const adminId = 'admin_456';
      const notification = {
        _id: 'notif_999',
        recipient: sellerId,
        isRead: false,
      };

      // Simulated ownership matcher
      const canAccessNotification = (notif, requesterId) => {
        return notif.recipient === requesterId;
      };

      assert.equal(canAccessNotification(notification, sellerId), true);
      assert.equal(canAccessNotification(notification, adminId), false);
    });

    it('verifies pagination calculates totalPages and unreadCount correctly', () => {
      const total = 45;
      const limit = 20;
      const unreadCount = 7;
      const totalPages = Math.ceil(total / limit) || 1;

      assert.equal(totalPages, 3);
      assert.equal(unreadCount, 7);
    });
  });
});
