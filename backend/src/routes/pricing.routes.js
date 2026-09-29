import { Router } from 'express';
import {
  listPriceRules,
  createPriceRule,
  updatePriceRule,
  deletePriceRule,
  seedDefaultPriceRules,
  simulatePricing,
  calculateBatchDynamicPrice,
  recalculateAllBatches,
  getPurchasePriceSnapshot,
  listPriceAuditLogs,
} from '../controllers/priceRule.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createPriceRuleSchema,
  updatePriceRuleSchema,
  simulatePricingSchema,
} from '../validators/pricing.validator.js';

const router = Router();

// 1. View Configurable PriceRules & Simulate Pricing
router.get('/rules', listPriceRules);
router.post('/simulate', validateRequest(simulatePricingSchema), simulatePricing);

// 2. Admin: Create, Update, Delete, and Seed PriceRules
router.post(
  '/rules/seed-defaults',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  seedDefaultPriceRules
);

router.post(
  '/rules',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(createPriceRuleSchema),
  createPriceRule
);

router.put(
  '/rules/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(updatePriceRuleSchema),
  updatePriceRule
);

router.patch(
  '/rules/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(updatePriceRuleSchema),
  updatePriceRule
);

router.delete(
  '/rules/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  deletePriceRule
);

// 3. Batch Dynamic Pricing Evaluation & Bulk Recalculation
router.get('/batch/:batchId', optionalAuthenticate, calculateBatchDynamicPrice);
router.post(
  '/batch/:batchId/recalculate',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  calculateBatchDynamicPrice
);

router.post(
  '/recalculate-all',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  recalculateAllBatches
);

// 4. Purchase-Time Price Snapshot & Price Audit Logs
router.post('/purchase-snapshot', authenticate, getPurchasePriceSnapshot);
router.get(
  '/audit-logs',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  listPriceAuditLogs
);

export default router;
