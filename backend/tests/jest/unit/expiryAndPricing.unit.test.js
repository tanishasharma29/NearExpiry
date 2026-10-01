import {
  calculateRemainingDays,
  computeBatchStatus,
  isBatchPurchasable,
  BATCH_STATUS,
  toCalendarDayEpochUTC,
} from '../../../src/utils/shelfLife.js';
import { evaluateDynamicPricingAlgorithm } from '../../../src/services/pricing.service.js';

describe('Unit Tests: Expiry Calculation, Shelf-Life Rules & Dynamic Pricing', () => {
  const sampleRules = [
    {
      _id: 'rule-0-2',
      name: '0-2 Days Critical Clearance',
      minDays: 0,
      maxDays: 2,
      discountPercentage: 75,
      isActive: true,
      priority: 10,
    },
    {
      _id: 'rule-3-7',
      name: '3-7 Days Urgent Clearance',
      minDays: 3,
      maxDays: 7,
      discountPercentage: 60,
      isActive: true,
      priority: 8,
    },
    {
      _id: 'rule-8-15',
      name: '8-15 Days Approaching Expiry',
      minDays: 8,
      maxDays: 15,
      discountPercentage: 40,
      isActive: true,
      priority: 6,
    },
    {
      _id: 'rule-16-30',
      name: '16-30 Days Moderate Markdown',
      minDays: 16,
      maxDays: 30,
      discountPercentage: 20,
      isActive: true,
      priority: 4,
    },
    {
      _id: 'rule-31-plus',
      name: '31+ Days Regular Price',
      minDays: 31,
      maxDays: null,
      discountPercentage: 0,
      isActive: true,
      priority: 1,
    },
  ];

  // --------------------------------------------------------------------------
  // 1. EXPIRY CALCULATION & TIMEZONE INTEGRITY
  // --------------------------------------------------------------------------
  describe('Expiry Calculation (calculateRemainingDays)', () => {
    it('Given a future expiry date exactly 5 calendar days away, When remainingDays is computed, Then returns 5', () => {
      // Given
      const today = new Date('2026-10-10T12:00:00Z');
      const expiry = new Date('2026-10-15T18:00:00Z');

      // When
      const days = calculateRemainingDays(expiry, today);

      // Then
      expect(days).toBe(5);
    });

    it('Given an expiry date on the current calendar day, When remainingDays is computed, Then returns 0 (last day of validity)', () => {
      // Given
      const today = new Date('2026-10-10T08:00:00Z');
      const expiry = new Date('2026-10-10T23:59:59Z');

      // When
      const days = calculateRemainingDays(expiry, today);

      // Then
      expect(days).toBe(0);
    });

    it('Given an expiry date in the past (yesterday), When remainingDays is computed, Then returns negative integer (-1)', () => {
      // Given
      const today = new Date('2026-10-10T10:00:00Z');
      const expiry = new Date('2026-10-09T10:00:00Z');

      // When
      const days = calculateRemainingDays(expiry, today);

      // Then
      expect(days).toBe(-1);
    });

    it('Given an invalid non-parseable date string, When calculating epoch, Then throws descriptive Error', () => {
      // Given
      const invalidDate = 'not-a-valid-date';

      // When / Then
      expect(() => toCalendarDayEpochUTC(invalidDate)).toThrow(
        'Invalid date supplied to shelf-life calculator'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. BATCH STATUS DETERMINATION & EXPIRED PRODUCT PREVENTION
  // --------------------------------------------------------------------------
  describe('Shelf-Life Status & Expired-Product Prevention (computeBatchStatus & isBatchPurchasable)', () => {
    it('Given remainingDays < 0, When status and purchasability are checked, Then status is EXPIRED and isPurchasable is FALSE', () => {
      // Given
      const remainingDays = -2;
      const quantity = 10;

      // When
      const status = computeBatchStatus(remainingDays, quantity);
      const purchasable = isBatchPurchasable(remainingDays, quantity, status);

      // Then
      expect(status).toBe(BATCH_STATUS.EXPIRED);
      expect(purchasable).toBe(false);
    });

    it('Given remainingDays = 0 and stock = 5, When status is checked, Then status is CRITICAL and isPurchasable is TRUE (last day)', () => {
      // Given
      const remainingDays = 0;
      const quantity = 5;

      // When
      const status = computeBatchStatus(remainingDays, quantity);
      const purchasable = isBatchPurchasable(remainingDays, quantity, status);

      // Then
      expect(status).toBe(BATCH_STATUS.CRITICAL);
      expect(purchasable).toBe(true);
    });

    it('Given stock quantity is 0 with remainingDays > 0, When status is checked, Then status is OUT_OF_STOCK and isPurchasable is FALSE', () => {
      // Given
      const remainingDays = 12;
      const quantity = 0;

      // When
      const status = computeBatchStatus(remainingDays, quantity);
      const purchasable = isBatchPurchasable(remainingDays, quantity, status);

      // Then
      expect(status).toBe(BATCH_STATUS.OUT_OF_STOCK);
      expect(purchasable).toBe(false);
    });

    it('Given remainingDays between 1 and 7, When status is evaluated, Then status is CRITICAL', () => {
      // Given & When & Then
      expect(computeBatchStatus(1, 10)).toBe(BATCH_STATUS.CRITICAL);
      expect(computeBatchStatus(7, 10)).toBe(BATCH_STATUS.CRITICAL);
    });

    it('Given remainingDays between 8 and 30, When status is evaluated, Then status is APPROACHING_EXPIRY', () => {
      // Given & When & Then
      expect(computeBatchStatus(8, 10)).toBe(BATCH_STATUS.APPROACHING_EXPIRY);
      expect(computeBatchStatus(30, 10)).toBe(BATCH_STATUS.APPROACHING_EXPIRY);
    });

    it('Given remainingDays > 30, When status is evaluated, Then status is NORMAL', () => {
      // Given & When & Then
      expect(computeBatchStatus(31, 10)).toBe(BATCH_STATUS.NORMAL);
      expect(computeBatchStatus(90, 10)).toBe(BATCH_STATUS.NORMAL);
    });
  });

  // --------------------------------------------------------------------------
  // 3. DYNAMIC PRICING ALGORITHM & EDGE CASES
  // --------------------------------------------------------------------------
  describe('Dynamic Pricing Algorithm (evaluateDynamicPricingAlgorithm)', () => {
    it('Given a 1-day remaining batch with MRP 500, When evaluated against clearance tier (75%), Then returns finalPrice 125', () => {
      // Given
      const originalPrice = 500;
      const remainingDays = 1;

      // When
      const result = evaluateDynamicPricingAlgorithm({
        originalPrice,
        remainingDays,
        quantity: 10,
        rules: sampleRules,
      });

      // Then
      expect(result.discountPercentage).toBe(75);
      expect(result.finalPrice).toBe(125.0);
      expect(result.status).toBe(BATCH_STATUS.CRITICAL);
      expect(result.isPurchasable).toBe(true);
      expect(result.appliedRuleName).toBe('0-2 Days Critical Clearance');
    });

    it('Given a 5-day remaining batch with MRP 200, When evaluated against 3-7 day tier (60%), Then returns finalPrice 80', () => {
      // Given
      const originalPrice = 200;
      const remainingDays = 5;

      // When
      const result = evaluateDynamicPricingAlgorithm({
        originalPrice,
        remainingDays,
        quantity: 10,
        rules: sampleRules,
      });

      // Then
      expect(result.discountPercentage).toBe(60);
      expect(result.finalPrice).toBe(80.0);
      expect(result.status).toBe(BATCH_STATUS.CRITICAL);
      expect(result.isPurchasable).toBe(true);
    });

    it('Given an expired batch (remainingDays = -1), When pricing is evaluated, Then locks purchase and returns isPurchasable FALSE', () => {
      // Given
      const originalPrice = 300;
      const remainingDays = -1;

      // When
      const result = evaluateDynamicPricingAlgorithm({
        originalPrice,
        remainingDays,
        quantity: 10,
        rules: sampleRules,
      });

      // Then
      expect(result.status).toBe(BATCH_STATUS.EXPIRED);
      expect(result.isPurchasable).toBe(false);
      expect(result.appliedRuleName).toBe('EXPIRED_LOCKOUT');
    });

    it('Given invalid originalPrice (<= 0 or non-number), When evaluated, Then throws validation ApiError', () => {
      // Given & When & Then
      expect(() =>
        evaluateDynamicPricingAlgorithm({
          originalPrice: -50,
          remainingDays: 5,
          rules: sampleRules,
        })
      ).toThrow('originalPrice must be a positive number.');

      expect(() =>
        evaluateDynamicPricingAlgorithm({
          originalPrice: 0,
          remainingDays: 5,
          rules: sampleRules,
        })
      ).toThrow('originalPrice must be a positive number.');
    });

    it('Given boundary conditions at day 2, 3, 7, 8, 30, and 31, When evaluated, Then transitions smoothly between adjacent discount tiers', () => {
      // Day 2 (Critical 75%)
      const r2 = evaluateDynamicPricingAlgorithm({ originalPrice: 100, remainingDays: 2, rules: sampleRules });
      expect(r2.discountPercentage).toBe(75);
      expect(r2.finalPrice).toBe(25);

      // Day 3 (Urgent 60%)
      const r3 = evaluateDynamicPricingAlgorithm({ originalPrice: 100, remainingDays: 3, rules: sampleRules });
      expect(r3.discountPercentage).toBe(60);
      expect(r3.finalPrice).toBe(40);

      // Day 7 (Urgent 60%)
      const r7 = evaluateDynamicPricingAlgorithm({ originalPrice: 100, remainingDays: 7, rules: sampleRules });
      expect(r7.discountPercentage).toBe(60);
      expect(r7.finalPrice).toBe(40);

      // Day 8 (Approaching 40%)
      const r8 = evaluateDynamicPricingAlgorithm({ originalPrice: 100, remainingDays: 8, rules: sampleRules });
      expect(r8.discountPercentage).toBe(40);
      expect(r8.finalPrice).toBe(60);

      // Day 30 (Moderate 20%)
      const r30 = evaluateDynamicPricingAlgorithm({ originalPrice: 100, remainingDays: 30, rules: sampleRules });
      expect(r30.discountPercentage).toBe(20);
      expect(r30.finalPrice).toBe(80);

      // Day 31 (Regular 0%)
      const r31 = evaluateDynamicPricingAlgorithm({ originalPrice: 100, remainingDays: 31, rules: sampleRules });
      expect(r31.discountPercentage).toBe(0);
      expect(r31.finalPrice).toBe(100);
    });
  });
});
